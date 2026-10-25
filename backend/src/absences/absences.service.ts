import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthUser } from '../auth/auth.types';
import { todayInSchool, toDateString } from '../common/dates';
import { pageArgs, paginated } from '../common/dto/pagination.dto';
import {
  personSelect,
  subjectSummarySelect,
  toPerson,
} from '../common/mappers';
import {
  DomainEvents,
  type AbsencesRecordedEvent,
} from '../events/domain-events';
import { Prisma, Role, SchoolYearStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  schoolYearSelect,
  type SchoolYearRow,
  type Semester,
} from '../school-years/school-year';
import {
  SchoolYearsService,
  toSchoolYearDto,
} from '../school-years/school-years.service';
import {
  AbsenceDto,
  AbsenceQueryDto,
  AttendanceResultDto,
  ClassAbsencesDto,
  ExcuseAbsencesDto,
  ExcuseResultDto,
  PaginatedAbsencesDto,
  TakeAttendanceDto,
  UpdateAbsenceDto,
} from './dto/absence.dto';
import { warningThreshold } from './limits';

const userSelect = { id: true, firstName: true, lastName: true } as const;

const absenceSelect = {
  id: true,
  date: true,
  semester: true,
  schoolYearId: true,
  excused: true,
  excusedAt: true,
  excuseNote: true,
  createdAt: true,
  recordedById: true,
  student: { select: personSelect },
  subject: { select: subjectSummarySelect },
  recordedBy: { select: userSelect },
  excusedBy: { select: userSelect },
} satisfies Prisma.AbsenceSelect;

type AbsenceRow = Prisma.AbsenceGetPayload<{ select: typeof absenceSelect }>;

/** What a teacher may see and change: their homeroom classes, and the subjects they teach. */
interface TeacherScope {
  /** Classes they are the homeroom teacher of, with their year. */
  homeroom: { id: string; schoolYearId: string }[];
  /** Subjects they teach, by class. */
  teaching: { classId: string; schoolYearId: string; subjectId: string }[];
  /** "<school year id>:<student id>" of the students of their homeroom classes. */
  homeroomStudents: Set<string>;
}

/**
 * Absences. A teacher takes attendance in a subject they teach; the
 * homeroom teacher, the teacher who recorded an absence and admins can
 * excuse or delete it. Unexcused absences count against the subject's limit
 * per semester (class_subjects.max_absences).
 */
@Injectable()
export class AbsencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly years: SchoolYearsService,
    private readonly events: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------- writes

  /**
   * The students who missed a lesson. One absence per student, subject and
   * day: a student already marked absent that day is counted, not doubled.
   */
  async takeAttendance(
    user: AuthUser,
    dto: TakeAttendanceDto,
  ): Promise<AttendanceResultDto> {
    const schoolClass = await this.prisma.class.findUnique({
      where: { id: dto.classId },
      select: { name: true, schoolYear: { select: schoolYearSelect } },
    });
    if (!schoolClass) throw new NotFoundException('Class not found');
    const year = schoolClass.schoolYear;
    this.years.assertOpen(year);
    if (dto.semester !== undefined && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only an administrator can choose the semester',
      );
    }
    const semester = dto.semester ?? (year.currentSemester as Semester);
    this.years.assertGradesWritable(user, year, semester);

    const assignment = await this.prisma.classSubject.findUnique({
      where: {
        classId_subjectId: { classId: dto.classId, subjectId: dto.subjectId },
      },
      select: {
        maxAbsences: true,
        subject: { select: { name: true } },
        teacher: { select: { userId: true } },
      },
    });
    if (!assignment) {
      throw new BadRequestException('This subject is not taught in this class');
    }
    if (user.role === Role.TEACHER && assignment.teacher?.userId !== user.id) {
      throw new ForbiddenException(
        `You don't teach ${assignment.subject.name} in ${schoolClass.name}`,
      );
    }

    const studentIds = [...new Set(dto.studentIds)];
    const enrolled = await this.prisma.enrollment.count({
      where: { classId: dto.classId, studentId: { in: studentIds } },
    });
    if (enrolled !== studentIds.length) {
      throw new BadRequestException(
        `${studentIds.length - enrolled} of the students are not in ${schoolClass.name}`,
      );
    }
    if (studentIds.length === 0) return { recorded: 0, alreadyAbsent: 0 };

    const day = dto.date ?? todayInSchool();
    this.assertInSemester(day, year, semester);
    const date = new Date(day);
    const counted = {
      subjectId: dto.subjectId,
      schoolYearId: year.id,
      semester,
      excused: false,
    };
    const { recorded, before, after } = await this.prisma.$transaction(
      async (tx) => {
        const countBy = async () =>
          tx.absence.groupBy({
            by: ['studentId'],
            where: { ...counted, studentId: { in: studentIds } },
            _count: { _all: true },
          });
        const beforeRows = await countBy();
        const created = await tx.absence.createMany({
          data: studentIds.map((studentId) => ({
            studentId,
            subjectId: dto.subjectId,
            schoolYearId: year.id,
            semester,
            date,
            recordedById: user.id,
          })),
          skipDuplicates: true,
        });
        return {
          recorded: created.count,
          before: beforeRows,
          after: await countBy(),
        };
      },
    );

    const countOf = (rows: typeof before, studentId: string) =>
      rows.find((r) => r.studentId === studentId)?._count._all ?? 0;
    const event: AbsencesRecordedEvent = {
      actorId: user.id,
      classId: dto.classId,
      subjectId: dto.subjectId,
      maxAbsences: assignment.maxAbsences,
      counts: studentIds.map((studentId) => ({
        studentId,
        before: countOf(before, studentId),
        after: countOf(after, studentId),
      })),
    };
    await this.events.emitAsync(DomainEvents.AbsencesRecorded, event);
    return { recorded, alreadyAbsent: studentIds.length - recorded };
  }

  /** Excuses an absence, or takes the excuse back. */
  async update(
    user: AuthUser,
    id: string,
    dto: UpdateAbsenceDto,
  ): Promise<AbsenceDto> {
    await this.changeable(user, id);
    const row = await this.prisma.absence.update({
      where: { id },
      data: dto.excused
        ? {
            excused: true,
            excusedAt: new Date(),
            excusedById: user.id,
            excuseNote: dto.note || null,
          }
        : {
            excused: false,
            excusedAt: null,
            excusedById: null,
            excuseNote: null,
          },
      select: absenceSelect,
    });
    return this.toDto(user, row, await this.scopeOf(user));
  }

  /**
   * Excuses every unexcused absence of a student between two days, in
   * every subject (e.g. a medical note). Homeroom teacher and admins.
   */
  async excuseRange(
    user: AuthUser,
    dto: ExcuseAbsencesDto,
  ): Promise<ExcuseResultDto> {
    if (dto.from > dto.to) {
      throw new BadRequestException('The first day comes after the last one');
    }
    const year = await this.years.active();
    const schoolClass = await this.prisma.class.findFirst({
      where: {
        schoolYearId: year.id,
        enrollments: { some: { studentId: dto.studentId } },
      },
      select: { homeroomTeacher: { select: { userId: true } } },
    });
    if (!schoolClass) {
      throw new BadRequestException(
        'The student is not in a class this school year',
      );
    }
    if (
      user.role !== Role.ADMIN &&
      schoolClass.homeroomTeacher?.userId !== user.id
    ) {
      throw new ForbiddenException(
        "Only the student's homeroom teacher or an administrator can excuse absences for several days",
      );
    }
    const { count } = await this.prisma.absence.updateMany({
      where: {
        studentId: dto.studentId,
        schoolYearId: year.id,
        excused: false,
        date: { gte: new Date(dto.from), lte: new Date(dto.to) },
      },
      data: {
        excused: true,
        excusedAt: new Date(),
        excusedById: user.id,
        excuseNote: dto.note || null,
      },
    });
    return { excused: count };
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.changeable(user, id);
    await this.prisma.absence.delete({ where: { id } });
  }

  // ----------------------------------------------------------------- reads

  /** Absences the user may see, newest first, a page at a time. */
  async findAll(
    user: AuthUser,
    query: AbsenceQueryDto,
  ): Promise<PaginatedAbsencesDto> {
    const year = await this.years.resolveYear(query.schoolYearId);
    const scope = await this.scopeOf(user);
    let classFilter: Prisma.AbsenceWhereInput = {};
    if (query.classId) {
      const schoolClass = await this.prisma.class.findUnique({
        where: { id: query.classId },
        select: { schoolYearId: true },
      });
      if (!schoolClass) throw new NotFoundException('Class not found');
      classFilter = {
        schoolYearId: schoolClass.schoolYearId,
        student: { enrollments: { some: { classId: query.classId } } },
      };
    }
    const where: Prisma.AbsenceWhereInput = {
      AND: [
        this.visibleTo(user, scope),
        query.classId ? classFilter : { schoolYearId: year.id },
        {
          ...(query.semester && { semester: query.semester }),
          ...(query.subjectId && { subjectId: query.subjectId }),
          ...(query.studentId && { studentId: query.studentId }),
          ...(query.excused !== undefined && { excused: query.excused }),
        },
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.absence.findMany({
        where,
        select: absenceSelect,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.absence.count({ where }),
    ]);
    const open = await this.openYearId();
    return paginated(
      rows.map((row) => this.toDto(user, row, scope, open)),
      total,
      query,
    );
  }

  /**
   * Every student of a class with their absences in a semester, by subject,
   * and how close they are to the limits. Homeroom teacher and admins.
   */
  async forClass(
    user: AuthUser,
    classId: string,
    semester?: Semester,
  ): Promise<ClassAbsencesDto> {
    const schoolClass = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        schoolYear: { select: { id: true } },
        homeroomTeacher: { select: { userId: true } },
        subjects: {
          select: {
            maxAbsences: true,
            subject: { select: subjectSummarySelect },
          },
          orderBy: { subject: { name: 'asc' } },
        },
      },
    });
    if (!schoolClass) throw new NotFoundException('Class not found');
    if (
      user.role !== Role.ADMIN &&
      schoolClass.homeroomTeacher?.userId !== user.id
    ) {
      throw new ForbiddenException(
        'Only the homeroom teacher and administrators see the absences of the whole class',
      );
    }
    const { year, semester: shown } = await this.years.resolvePeriod({
      schoolYearId: schoolClass.schoolYear.id,
      semester,
    });

    const students = await this.prisma.student.findMany({
      where: { enrollments: { some: { classId } } },
      select: { ...personSelect, registrationNumber: true },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
    const counts = await this.prisma.absence.groupBy({
      by: ['studentId', 'subjectId', 'excused'],
      where: {
        schoolYearId: year.id,
        semester: shown,
        studentId: { in: students.map((s) => s.id) },
      },
      _count: { _all: true },
    });
    const count = (studentId: string, subjectId: string, excused: boolean) =>
      counts.find(
        (c) =>
          c.studentId === studentId &&
          c.subjectId === subjectId &&
          c.excused === excused,
      )?._count._all ?? 0;

    return {
      class: { id: schoolClass.id, name: schoolClass.name },
      period: { schoolYear: toSchoolYearDto(year), semester: shown },
      readOnly: year.status !== SchoolYearStatus.ACTIVE,
      students: students.map((student) => {
        const subjects = schoolClass.subjects.map((cs) => ({
          subject: cs.subject,
          maxAbsences: cs.maxAbsences,
          unexcused: count(student.id, cs.subject.id, false),
          excused: count(student.id, cs.subject.id, true),
        }));
        const mine = counts.filter((c) => c.studentId === student.id);
        const sum = (excused: boolean) =>
          mine
            .filter((c) => c.excused === excused)
            .reduce((total, c) => total + c._count._all, 0);
        return {
          student: toPerson(student),
          registrationNumber: student.registrationNumber,
          total: { unexcused: sum(false), excused: sum(true) },
          subjects,
          overLimit: subjects.filter(
            (s) => s.maxAbsences !== null && s.unexcused > s.maxAbsences,
          ).length,
          nearLimit: subjects.filter(
            (s) =>
              s.maxAbsences !== null &&
              s.maxAbsences > 0 &&
              s.unexcused <= s.maxAbsences &&
              s.unexcused >= warningThreshold(s.maxAbsences),
          ).length,
        };
      }),
    };
  }

  // ---------------------------------------------------------------- helpers

  /** The day must fall in the semester: from 1 September, split where semester 1 ended. */
  private assertInSemester(
    day: string,
    year: SchoolYearRow,
    semester: Semester,
  ): void {
    const ended = year.semester1EndedAt && toDateString(year.semester1EndedAt);
    const tooEarly =
      day < `${year.startYear}-09-01` ||
      (semester === 2 && ended !== null && day <= ended);
    const tooLate = semester === 1 && ended !== null && day > ended;
    if (tooEarly || tooLate) {
      throw new BadRequestException(
        `${day} is not in semester ${semester} of ${year.startYear}–${year.startYear + 1}`,
      );
    }
  }

  /** The absence, if the user may excuse or delete it (in an open year). */
  private async changeable(user: AuthUser, id: string): Promise<void> {
    const absence = await this.prisma.absence.findUnique({
      where: { id },
      select: {
        recordedById: true,
        schoolYear: { select: schoolYearSelect },
        student: {
          select: {
            userId: true,
            enrollments: {
              select: {
                schoolYearId: true,
                class: {
                  select: { homeroomTeacher: { select: { userId: true } } },
                },
              },
            },
          },
        },
      },
    });
    const visible =
      absence &&
      (user.role !== Role.STUDENT || absence.student.userId === user.id);
    if (!absence || !visible) throw new NotFoundException('Absence not found');
    this.years.assertOpen(absence.schoolYear);
    const homeroomUserId = absence.student.enrollments.find(
      (e) => e.schoolYearId === absence.schoolYear.id,
    )?.class.homeroomTeacher?.userId;
    const allowed =
      user.role === Role.ADMIN ||
      (user.role === Role.TEACHER &&
        (absence.recordedById === user.id || homeroomUserId === user.id));
    if (!allowed) {
      throw new ForbiddenException(
        'Only the teacher who recorded it, the homeroom teacher or an administrator can change an absence',
      );
    }
  }

  private async scopeOf(user: AuthUser): Promise<TeacherScope> {
    if (user.role !== Role.TEACHER) {
      return { homeroom: [], teaching: [], homeroomStudents: new Set() };
    }
    const [homeroom, teaching] = await Promise.all([
      this.prisma.class.findMany({
        where: { homeroomTeacher: { userId: user.id } },
        select: {
          id: true,
          schoolYearId: true,
          enrollments: { select: { studentId: true } },
        },
      }),
      this.prisma.classSubject.findMany({
        where: { teacher: { userId: user.id } },
        select: {
          classId: true,
          subjectId: true,
          class: { select: { schoolYearId: true } },
        },
      }),
    ]);
    return {
      homeroom: homeroom.map((c) => ({
        id: c.id,
        schoolYearId: c.schoolYearId,
      })),
      homeroomStudents: new Set(
        homeroom.flatMap((c) =>
          c.enrollments.map((e) => `${c.schoolYearId}:${e.studentId}`),
        ),
      ),
      teaching: teaching.map((t) => ({
        classId: t.classId,
        subjectId: t.subjectId,
        schoolYearId: t.class.schoolYearId,
      })),
    };
  }

  /** Admins: every absence. Teachers: their homeroom classes, their subjects. Students: theirs. */
  private visibleTo(
    user: AuthUser,
    scope: TeacherScope,
  ): Prisma.AbsenceWhereInput {
    if (user.role === Role.ADMIN) return {};
    if (user.role === Role.STUDENT) return { student: { userId: user.id } };
    const inClass = (classId: string, schoolYearId: string) => ({
      schoolYearId,
      student: { enrollments: { some: { classId } } },
    });
    const or: Prisma.AbsenceWhereInput[] = [
      ...scope.homeroom.map((c) => inClass(c.id, c.schoolYearId)),
      ...scope.teaching.map((t) => ({
        ...inClass(t.classId, t.schoolYearId),
        subjectId: t.subjectId,
      })),
    ];
    // Teaching nothing: nothing to see.
    return or.length > 0 ? { OR: or } : { id: { in: [] } };
  }

  private async openYearId(): Promise<string | null> {
    const year = await this.prisma.schoolYear.findFirst({
      where: { status: SchoolYearStatus.ACTIVE },
      select: { id: true },
    });
    return year?.id ?? null;
  }

  private toDto(
    user: AuthUser,
    row: AbsenceRow,
    scope: TeacherScope,
    openYearId: string | null = row.schoolYearId,
  ): AbsenceDto {
    const open = row.schoolYearId === openYearId;
    const canChange =
      open &&
      (user.role === Role.ADMIN ||
        (user.role === Role.TEACHER &&
          (row.recordedById === user.id ||
            scope.homeroomStudents.has(
              `${row.schoolYearId}:${row.student.id}`,
            ))));
    return {
      id: row.id,
      date: toDateString(row.date),
      semester: row.semester as Semester,
      student: toPerson(row.student),
      subject: row.subject,
      recordedBy: row.recordedBy,
      excused: row.excused,
      excusedAt: row.excusedAt,
      excusedBy: row.excusedBy,
      excuseNote: row.excuseNote,
      canChange,
      createdAt: row.createdAt,
    };
  }
}
