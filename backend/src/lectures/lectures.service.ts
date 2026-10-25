import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthUser } from '../auth/auth.types';
import { compareClassNames } from '../classes/class-names';
import { pageArgs, paginated } from '../common/dto/pagination.dto';
import {
  fullName,
  personSelect,
  subjectSummarySelect,
  toPerson,
} from '../common/mappers';
import { DomainEvents, type LectureSharedEvent } from '../events/domain-events';
import {
  LectureAccessAction,
  Prisma,
  Role,
  SchoolYearStatus,
  YearOutcome,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolYearsService } from '../school-years/school-years.service';
import { FILE_STORAGE, type FileStorage } from '../storage/storage';
import {
  CreateLectureDto,
  FileLinkDto,
  LectureDetailDto,
  LectureDto,
  LectureHistoryDto,
  LectureHistoryQueryDto,
  LectureQueryDto,
  LectureStudentDto,
  PaginatedLecturesDto,
  SetLectureStudentsDto,
  UpdateLectureDto,
} from './dto/lecture.dto';
import { cleanFileName, isPdf } from './pdf';
import { FOLD_FROM, FOLD_TO, foldText } from './search';

const PDF = 'application/pdf';

const lectureSelect = {
  id: true,
  title: true,
  description: true,
  fileKey: true,
  fileName: true,
  fileSize: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: subjectSummarySelect },
  teacher: { select: { ...personSelect, userId: true } },
  _count: { select: { access: true } },
} satisfies Prisma.LectureSelect;

type LectureRow = Prisma.LectureGetPayload<{ select: typeof lectureSelect }>;

/** A student with their class in the open year, as LectureStudentDto. */
const studentSelect = (openYearId: string | null) =>
  ({
    id: true,
    registrationNumber: true,
    user: { select: { firstName: true, lastName: true } },
    enrollments: {
      // No open year: no class to show.
      where: openYearId ? { schoolYearId: openYearId } : { id: { in: [] } },
      select: { class: { select: { id: true, name: true } } },
    },
  }) satisfies Prisma.StudentSelect;

type StudentRow = Prisma.StudentGetPayload<{
  select: ReturnType<typeof studentSelect>;
}>;

function toStudent(row: StudentRow): LectureStudentDto {
  return {
    id: row.id,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    registrationNumber: row.registrationNumber,
    class: row.enrollments[0]?.class ?? null,
  };
}

/** By class (9A before 10A, no class last), then by name. */
function byClassThenName(a: LectureStudentDto, b: LectureStudentDto): number {
  if (a.class && b.class && a.class.name !== b.class.name)
    return compareClassNames(a.class.name, b.class.name);
  if (!a.class !== !b.class) return a.class ? -1 : 1;
  return (
    a.lastName.localeCompare(b.lastName, 'ro') ||
    a.firstName.localeCompare(b.firstName, 'ro')
  );
}

/**
 * Lectures: a teacher's library of PDFs, not tied to a school year. The
 * teacher shares them with any students they choose; the access stays until
 * the teacher removes it, and every change is kept as the lecture's access
 * history. The files are in the storage (local folder or S3 bucket); readers
 * get short-lived links, only after the checks here.
 */
@Injectable()
export class LecturesService {
  private readonly logger = new Logger(LecturesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly years: SchoolYearsService,
    private readonly events: EventEmitter2,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  // ---------------------------------------------------------------- reading

  /**
   * The lectures the user can see, newest first, a page at a time: admins
   * every lecture, teachers their library, students the ones they can read
   * now. Also the subjects they have lectures in, for the filters.
   */
  async findAll(
    user: AuthUser,
    query: LectureQueryDto,
  ): Promise<PaginatedLecturesDto> {
    const visible = this.visibleTo(user);
    const where: Prisma.LectureWhereInput = {
      ...visible,
      ...(query.subjectId && { subjectId: query.subjectId }),
      ...(query.search && { id: { in: await this.matching(query.search) } }),
    };
    const [rows, total, subjects] = await Promise.all([
      this.prisma.lecture.findMany({
        where,
        select: lectureSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.lecture.count({ where }),
      this.prisma.subject.findMany({
        where: { lectures: { some: visible } },
        select: subjectSummarySelect,
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      ...paginated(
        rows.map((row) => this.toDto(user, row)),
        total,
        query,
      ),
      subjects,
    };
  }

  /** One lecture; who can read it is shown to the people who manage it. */
  async findOne(user: AuthUser, id: string): Promise<LectureDetailDto> {
    const row = await this.readable(user, id);
    const dto = this.toDto(user, row);
    if (!dto.canManage) return { ...dto, students: [] };

    const students = await this.prisma.student.findMany({
      where: { lectureAccess: { some: { lectureId: id } } },
      select: studentSelect(await this.openYearId()),
    });
    return { ...dto, students: students.map(toStudent).sort(byClassThenName) };
  }

  /**
   * Who got or lost access, newest first: one entry per change (a change
   * can be about many students), with who made it.
   */
  async history(
    user: AuthUser,
    id: string,
    query: LectureHistoryQueryDto,
  ): Promise<LectureHistoryDto> {
    await this.manageable(user, id);
    // The rows written by one change share their time, action and author.
    const groups = await this.prisma.lectureAccessEvent.groupBy({
      by: ['createdAt', 'action', 'actorId'],
      where: { lectureId: id },
      orderBy: [{ createdAt: 'desc' }, { action: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    const total = (
      await this.prisma.lectureAccessEvent.groupBy({
        by: ['createdAt', 'action', 'actorId'],
        where: { lectureId: id },
      })
    ).length;
    if (groups.length === 0) return paginated([], total, query);

    const openYearId = await this.openYearId();
    const events = await this.prisma.lectureAccessEvent.findMany({
      where: {
        lectureId: id,
        createdAt: { in: groups.map((g) => g.createdAt) },
      },
      select: {
        createdAt: true,
        action: true,
        actorId: true,
        actor: { select: { id: true, firstName: true, lastName: true } },
        student: { select: studentSelect(openYearId) },
      },
    });
    const key = (e: {
      createdAt: Date;
      action: LectureAccessAction;
      actorId: string | null;
    }) => `${e.createdAt.toISOString()}|${e.action}|${e.actorId ?? ''}`;
    const changes = groups.map((group) => {
      const rows = events.filter((e) => key(e) === key(group));
      return {
        at: group.createdAt,
        action: group.action,
        actor: rows[0]?.actor ?? null,
        students: rows.map((e) => toStudent(e.student)).sort(byClassThenName),
      };
    });
    return paginated(changes, total, query);
  }

  /**
   * Everyone a lecture can be shared with: the students of the open year
   * (from any class) and the ones without a class yet, graduates excluded.
   */
  async recipients(): Promise<LectureStudentDto[]> {
    const year = await this.years.active();
    const rows = await this.prisma.student.findMany({
      where: {
        OR: [
          { enrollments: { some: { schoolYearId: year.id } } },
          {
            enrollments: {
              none: {
                OR: [
                  { schoolYearId: year.id },
                  { outcome: YearOutcome.GRADUATED },
                ],
              },
            },
          },
        ],
      },
      select: studentSelect(year.id),
    });
    return rows.map(toStudent).sort(byClassThenName);
  }

  /** A short-lived link to preview or download the PDF. */
  async link(
    user: AuthUser,
    id: string,
    download = false,
  ): Promise<FileLinkDto> {
    const row = await this.readable(user, id);
    return this.storage.link(row.fileKey, {
      disposition: download ? 'attachment' : 'inline',
      fileName: row.fileName,
      contentType: PDF,
    });
  }

  // ---------------------------------------------------------------- writing

  /**
   * A teacher adds a PDF to their library, in a subject they teach this
   * year, and shares it with some students.
   */
  async create(
    user: AuthUser,
    dto: CreateLectureDto,
    file: Express.Multer.File | undefined,
  ): Promise<LectureDetailDto> {
    if (!file) throw new BadRequestException('Choose a PDF file to upload');
    if (!isPdf(file.buffer)) {
      throw new BadRequestException(`${file.originalname} is not a PDF file`);
    }
    const teacher = await this.teacherOf(user);
    await this.assertTeaches(user, dto.subjectId);
    const studentIds = await this.existingStudents(dto.studentIds);

    const fileKey = `lectures/${randomUUID()}.pdf`;
    await this.storage.put(fileKey, file.buffer, PDF);
    const now = new Date();
    let id: string;
    try {
      ({ id } = await this.prisma.lecture.create({
        data: {
          teacherId: teacher.id,
          subjectId: dto.subjectId,
          title: dto.title,
          description: dto.description || null,
          fileKey,
          fileName: cleanFileName(file.originalname),
          fileSize: file.size,
          access: {
            createMany: {
              data: studentIds.map((studentId) => ({
                studentId,
                grantedAt: now,
              })),
            },
          },
          accessEvents: {
            createMany: {
              data: studentIds.map((studentId) => ({
                studentId,
                action: LectureAccessAction.GRANTED,
                actorId: user.id,
                createdAt: now,
              })),
            },
          },
        },
        select: { id: true },
      }));
    } catch (error) {
      // Don't leave a file nobody can reach.
      await this.removeFile(fileKey);
      throw error;
    }
    await this.announce(user, id, studentIds);
    return this.findOne(user, id);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateLectureDto,
  ): Promise<LectureDetailDto> {
    const row = await this.manageable(user, id);
    if (dto.subjectId && dto.subjectId !== row.subject.id) {
      await this.assertTeaches(user, dto.subjectId);
    }
    await this.prisma.lecture.update({
      where: { id },
      data: {
        title: dto.title,
        subjectId: dto.subjectId,
        ...(dto.description !== undefined && {
          description: dto.description || null,
        }),
      },
    });
    return this.findOne(user, id);
  }

  /**
   * Replaces who can read the lecture. The students who got or lost access
   * are written to the history; the new readers are notified.
   */
  async setStudents(
    user: AuthUser,
    id: string,
    dto: SetLectureStudentsDto,
  ): Promise<LectureDetailDto> {
    await this.manageable(user, id);
    const studentIds = await this.existingStudents(dto.studentIds);
    const now = new Date();
    const added = await this.prisma.$transaction(async (tx) => {
      const before = await tx.lectureAccess.findMany({
        where: { lectureId: id },
        select: { studentId: true },
      });
      const had = new Set(before.map((a) => a.studentId));
      const wanted = new Set(studentIds);
      const fresh = studentIds.filter((studentId) => !had.has(studentId));
      const gone = [...had].filter((studentId) => !wanted.has(studentId));

      await tx.lectureAccess.deleteMany({
        where: { lectureId: id, studentId: { in: gone } },
      });
      await tx.lectureAccess.createMany({
        data: fresh.map((studentId) => ({
          lectureId: id,
          studentId,
          grantedAt: now,
        })),
        skipDuplicates: true,
      });
      await tx.lectureAccessEvent.createMany({
        data: [
          ...fresh.map((studentId) => ({
            studentId,
            action: LectureAccessAction.GRANTED,
          })),
          ...gone.map((studentId) => ({
            studentId,
            action: LectureAccessAction.REVOKED,
          })),
        ].map((event) => ({
          ...event,
          lectureId: id,
          actorId: user.id,
          createdAt: now,
        })),
      });
      return fresh;
    });
    await this.announce(user, id, added);
    return this.findOne(user, id);
  }

  /** Deletes the lecture, its history and its file. */
  async remove(user: AuthUser, id: string): Promise<void> {
    const row = await this.manageable(user, id);
    await this.prisma.lecture.delete({ where: { id } });
    await this.removeFile(row.fileKey);
  }

  // ---------------------------------------------------------------- helpers

  /**
   * The lectures whose title, description, subject or teacher contain every
   * word of the search, ignoring case and Romanian diacritics ("creanga"
   * finds "Creangă").
   */
  private async matching(search: string): Promise<string[]> {
    const words = foldText(search).split(/\s+/).filter(Boolean).slice(0, 10);
    if (words.length === 0) return [];
    const text = Prisma.sql`lower(translate(concat_ws(' ', l.title, l.description, s.name, u.first_name, u.last_name), ${FOLD_FROM}, ${FOLD_TO}))`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT l.id
      FROM lectures l
      JOIN subjects s ON s.id = l.subject_id
      LEFT JOIN teachers t ON t.id = l.teacher_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE ${Prisma.join(
        words.map(
          (word) =>
            Prisma.sql`${text} LIKE ${`%${word.replace(/[\\%_]/g, '\\$&')}%`}`,
        ),
        ' AND ',
      )}`;
    return rows.map((row) => row.id);
  }

  /** Admins see every lecture, teachers their library, students what they can read. */
  private visibleTo(user: AuthUser): Prisma.LectureWhereInput {
    switch (user.role) {
      case Role.ADMIN:
        return {};
      case Role.TEACHER:
        return { teacher: { userId: user.id } };
      default:
        return { access: { some: { student: { userId: user.id } } } };
    }
  }

  private canManage(user: AuthUser, row: LectureRow): boolean {
    return (
      user.role === Role.ADMIN ||
      (user.role === Role.TEACHER && row.teacher?.userId === user.id)
    );
  }

  /** The lecture if the user may read it; 404 otherwise (it isn't theirs to know about). */
  private async readable(user: AuthUser, id: string): Promise<LectureRow> {
    const row = await this.prisma.lecture.findFirst({
      where: { id, ...this.visibleTo(user) },
      select: lectureSelect,
    });
    if (!row) throw new NotFoundException('Lecture not found');
    return row;
  }

  /** The lecture if the user may change it (its teacher or an admin). */
  private async manageable(user: AuthUser, id: string): Promise<LectureRow> {
    const row = await this.readable(user, id);
    if (!this.canManage(user, row)) {
      throw new ForbiddenException(
        'Only the teacher whose lecture it is can change it',
      );
    }
    return row;
  }

  /** The open school year's id, or null between years. */
  private async openYearId(): Promise<string | null> {
    const year = await this.prisma.schoolYear.findFirst({
      where: { status: SchoolYearStatus.ACTIVE },
      select: { id: true },
      orderBy: { startYear: 'desc' },
    });
    return year?.id ?? null;
  }

  private async teacherOf(user: AuthUser): Promise<{ id: string }> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!teacher) throw new ForbiddenException('Only teachers share lectures');
    return teacher;
  }

  /** Teachers add lectures in the subjects they teach this year; admins in any. */
  private async assertTeaches(
    user: AuthUser,
    subjectId: string,
  ): Promise<void> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { name: true },
    });
    if (!subject) throw new BadRequestException('Unknown subject');
    if (user.role === Role.ADMIN) return;
    const year = await this.years.active();
    const teaches = await this.prisma.classSubject.count({
      where: {
        subjectId,
        teacher: { userId: user.id },
        class: { schoolYearId: year.id },
      },
    });
    if (teaches === 0) {
      throw new ForbiddenException(
        `You don't teach ${subject.name} this school year`,
      );
    }
  }

  /** The ids without duplicates; 400 if one isn't a student. */
  private async existingStudents(ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const found = await this.prisma.student.count({
      where: { id: { in: unique } },
    });
    if (found !== unique.length) {
      throw new BadRequestException(
        `${unique.length - found} of the students don't exist`,
      );
    }
    return unique;
  }

  private async announce(
    user: AuthUser,
    lectureId: string,
    studentIds: string[],
  ): Promise<void> {
    if (studentIds.length === 0) return;
    const lecture = await this.prisma.lecture.findUniqueOrThrow({
      where: { id: lectureId },
      select: {
        title: true,
        subject: { select: { name: true } },
        teacher: { select: personSelect },
      },
    });
    const event: LectureSharedEvent = {
      actorId: user.id,
      lectureId,
      title: lecture.title,
      subjectName: lecture.subject.name,
      teacherName: lecture.teacher ? fullName(lecture.teacher) : null,
      studentIds,
    };
    this.events.emit(DomainEvents.LectureShared, event);
  }

  private async removeFile(key: string): Promise<void> {
    try {
      await this.storage.remove(key);
    } catch (error) {
      // The lecture is gone either way; an orphan file only takes space.
      this.logger.warn(
        `Could not delete ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toDto(user: AuthUser, row: LectureRow): LectureDto {
    const canManage = this.canManage(user, row);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      subject: row.subject,
      teacher: toPerson(row.teacher),
      fileName: row.fileName,
      fileSize: row.fileSize,
      studentCount: canManage ? row._count.access : 0,
      canManage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
