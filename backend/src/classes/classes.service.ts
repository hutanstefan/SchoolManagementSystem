import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthUser } from '../auth/auth.types';
import { Paginated, pageArgs, paginated } from '../common/dto/pagination.dto';
import {
  personSelect,
  toPerson,
  subjectSummarySelect,
} from '../common/mappers';
import { Prisma, Role } from '../generated/prisma/client';
import {
  DomainEvents,
  type AssignmentChange,
  type AssignmentsChangedEvent,
} from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { gradeLevel, yearName } from '../school-years/school-year';
import { SchoolYearsService } from '../school-years/school-years.service';
import { compareClassNames } from './class-names';
import { StudentDto } from '../students/dto/student.dto';
import { studentSelect, toStudentDto } from '../students/student.mapper';
import {
  ClassDetailDto,
  ClassInYearDto,
  ClassDto,
  ClassQueryDto,
  CreateClassDto,
  UpdateClassDto,
} from './dto/class.dto';

const classSelect = {
  id: true,
  name: true,
  createdAt: true,
  schoolYear: { select: { id: true, startYear: true, status: true } },
  homeroomTeacher: { select: personSelect },
  _count: { select: { enrollments: true } },
} as const satisfies Prisma.ClassSelect;

type ClassRow = Prisma.ClassGetPayload<{ select: typeof classSelect }>;

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly years: SchoolYearsService,
  ) {}

  /**
   * The classes of a school year (the open one by default). Admins see every
   * class, teachers the classes they are assigned to, students their own.
   */
  async findAll(
    user: AuthUser,
    query: ClassQueryDto,
  ): Promise<Paginated<ClassDto>> {
    const year = await this.years.resolveYear(query.schoolYearId);
    const where: Prisma.ClassWhereInput = {
      schoolYearId: year.id,
      ...this.visibleTo(user),
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
    };

    if (query.sort === 'name') {
      // Class names need a natural sort ("9A" before "10A"), which SQL ordering
      // can't do on a text column. A school has at most a few dozen classes,
      // so sorting and paging them in memory is cheap.
      const all = await this.prisma.class.findMany({
        where,
        select: classSelect,
      });
      all.sort((a, b) => compareClassNames(a.name, b.name, query.order));
      const { skip, take } = pageArgs(query);
      return paginated(
        all.slice(skip, skip + take).map(toClassDto),
        all.length,
        query,
      );
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.class.findMany({
        where,
        select: classSelect,
        orderBy: { [query.sort]: query.order },
        ...pageArgs(query),
      }),
      this.prisma.class.count({ where }),
    ]);

    return paginated(rows.map(toClassDto), total, query);
  }

  async findOne(user: AuthUser, id: string): Promise<ClassDetailDto> {
    await this.assertCanView(user, id);

    const schoolClass = await this.prisma.class.findUniqueOrThrow({
      where: { id },
      select: {
        ...classSelect,
        subjects: {
          select: {
            id: true,
            hoursPerWeek: true,
            maxAbsences: true,
            subject: { select: subjectSummarySelect },
            teacher: { select: personSelect },
          },
          orderBy: { subject: { name: 'asc' } },
        },
      },
    });

    return {
      ...toClassDto(schoolClass),
      subjects: schoolClass.subjects.map((cs) => ({
        classSubjectId: cs.id,
        subject: cs.subject,
        teacher: toPerson(cs.teacher),
        hoursPerWeek: cs.hoursPerWeek,
        maxAbsences: cs.maxAbsences,
      })),
      lineage: await this.lineageOf(user, id),
    };
  }

  /**
   * The same class in every school year, oldest first: the classes it
   * continues (previousClassId, back to the first) and the ones continuing
   * it. Lets the app follow a class when another year is picked.
   */
  private async lineageOf(
    user: AuthUser,
    id: string,
  ): Promise<ClassInYearDto[]> {
    const select = {
      id: true,
      name: true,
      previousClassId: true,
      schoolYear: { select: { id: true, startYear: true, status: true } },
    } as const satisfies Prisma.ClassSelect;
    type Row = Prisma.ClassGetPayload<{ select: typeof select }>;

    const current = await this.prisma.class.findUniqueOrThrow({
      where: { id },
      select,
    });
    const chain: Row[] = [current];
    const seen = new Set([current.id]);
    // Back: last year's class, the year before...
    for (
      let previousId = current.previousClassId;
      previousId && !seen.has(previousId);
    ) {
      const row = await this.prisma.class.findUnique({
        where: { id: previousId },
        select,
      });
      if (!row) break;
      chain.unshift(row);
      seen.add(row.id);
      previousId = row.previousClassId;
    }
    // Forward: next year's class, and so on.
    for (let lastId = current.id; ;) {
      const row = await this.prisma.class.findFirst({
        where: { previousClassId: lastId },
        select,
        orderBy: { name: 'asc' },
      });
      if (!row || seen.has(row.id)) break;
      chain.push(row);
      seen.add(row.id);
      lastId = row.id;
    }

    let visible = chain;
    if (user.role !== Role.ADMIN) {
      const ids = new Set(
        (
          await this.prisma.class.findMany({
            where: {
              id: { in: chain.map((row) => row.id) },
              ...this.visibleTo(user),
            },
            select: { id: true },
          })
        ).map((row) => row.id),
      );
      visible = chain.filter((row) => ids.has(row.id));
    }
    return visible.map((row) => ({
      id: row.id,
      name: row.name,
      schoolYear: {
        id: row.schoolYear.id,
        name: yearName(row.schoolYear.startYear),
        status: row.schoolYear.status,
      },
    }));
  }

  async findStudents(user: AuthUser, id: string): Promise<StudentDto[]> {
    await this.assertCanView(user, id);
    return this.studentsOf(id);
  }

  private async studentsOf(id: string): Promise<StudentDto[]> {
    const { schoolYearId } = await this.prisma.class.findUniqueOrThrow({
      where: { id },
      select: { schoolYearId: true },
    });
    const students = await this.prisma.student.findMany({
      where: { enrollments: { some: { classId: id } } },
      select: studentSelect(schoolYearId),
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
    return students.map((student) => toStudentDto(student, schoolYearId));
  }

  /** A new class of the open school year. */
  async create(dto: CreateClassDto): Promise<ClassDto> {
    const year = await this.years.active();
    await this.assertNameIsFree(year.id, dto.name);
    if (dto.homeroomTeacherId) {
      await this.assertTeacherExists(dto.homeroomTeacherId);
    }

    const schoolClass = await this.prisma.class.create({
      data: {
        name: dto.name,
        schoolYearId: year.id,
        homeroomTeacherId: dto.homeroomTeacherId,
      },
      select: classSelect,
    });
    await this.publishHomeroomChange(
      schoolClass,
      null,
      dto.homeroomTeacherId ?? null,
    );
    return toClassDto(schoolClass);
  }

  async update(id: string, dto: UpdateClassDto): Promise<ClassDto> {
    const year = await this.years.assertClassOpen(id);
    if (dto.name) await this.assertNameIsFree(year.id, dto.name, id);
    if (dto.homeroomTeacherId) {
      await this.assertTeacherExists(dto.homeroomTeacherId);
    }

    const before = await this.prisma.class.findUniqueOrThrow({
      where: { id },
      select: { homeroomTeacherId: true },
    });
    const schoolClass = await this.prisma.class.update({
      where: { id },
      data: { name: dto.name, homeroomTeacherId: dto.homeroomTeacherId },
      select: classSelect,
    });
    if (dto.homeroomTeacherId !== undefined) {
      await this.publishHomeroomChange(
        schoolClass,
        before.homeroomTeacherId,
        dto.homeroomTeacherId,
      );
    }
    return toClassDto(schoolClass);
  }

  /** Tells the teachers who became, or stopped being, the homeroom teacher. */
  private async publishHomeroomChange(
    schoolClass: { id: string; name: string },
    fromTeacherId: string | null,
    toTeacherId: string | null,
  ): Promise<void> {
    if (fromTeacherId === toTeacherId) return;
    const ids = [fromTeacherId, toTeacherId].filter((id) => id !== null);
    const teachers = await this.prisma.teacher.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true },
    });
    const userOf = (teacherId: string | null) =>
      teachers.find((t) => t.id === teacherId)?.userId;

    const changes: AssignmentChange[] = [];
    const removed = userOf(fromTeacherId);
    const added = userOf(toTeacherId);
    const where = { classId: schoolClass.id, className: schoolClass.name };
    if (removed) {
      changes.push({
        kind: 'homeroom-removed',
        teacherUserId: removed,
        ...where,
      });
    }
    if (added) {
      changes.push({
        kind: 'homeroom-assigned',
        teacherUserId: added,
        ...where,
      });
    }
    if (changes.length === 0) return;
    const event: AssignmentsChangedEvent = { changes };
    await this.events.emitAsync(DomainEvents.AssignmentsChanged, event);
  }

  /**
   * Deletes the class with its teaching assignments and timetable.
   * Its students become unassigned; their grades are kept.
   */
  async remove(id: string): Promise<void> {
    await this.years.assertClassOpen(id);
    await this.prisma.class.delete({ where: { id } });
  }

  /**
   * Moves the given students into the class (out of their class of that
   * year, if any). Only in the open year.
   */
  async assignStudents(
    id: string,
    studentIds: string[],
  ): Promise<StudentDto[]> {
    const year = await this.years.assertClassOpen(id);

    const found = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true },
    });
    if (found.length !== studentIds.length) {
      const foundIds = new Set(found.map((s) => s.id));
      const missing = studentIds.filter((sid) => !foundIds.has(sid));
      throw new NotFoundException(`Students not found: ${missing.join(', ')}`);
    }

    await this.prisma.$transaction([
      this.prisma.enrollment.deleteMany({
        where: { studentId: { in: studentIds }, schoolYearId: year.id },
      }),
      this.prisma.enrollment.createMany({
        data: studentIds.map((studentId) => ({
          studentId,
          classId: id,
          schoolYearId: year.id,
        })),
      }),
    ]);
    return this.studentsOf(id);
  }

  async unassignStudent(id: string, studentId: string): Promise<void> {
    await this.years.assertClassOpen(id);
    const { count } = await this.prisma.enrollment.deleteMany({
      where: { studentId, classId: id },
    });
    if (count === 0) {
      throw new NotFoundException('Student is not enrolled in this class');
    }
  }

  /**
   * Where-clause limiting classes to the ones a user may see: admins see all,
   * teachers the classes they teach or are homeroom teacher of, students their own class.
   */
  private visibleTo(user: AuthUser): Prisma.ClassWhereInput {
    switch (user.role) {
      case Role.ADMIN:
        return {};
      case Role.TEACHER:
        return {
          OR: [
            { homeroomTeacher: { userId: user.id } },
            { subjects: { some: { teacher: { userId: user.id } } } },
          ],
        };
      case Role.STUDENT:
        return { enrollments: { some: { student: { userId: user.id } } } };
    }
  }

  /** 404 if the class doesn't exist, 403 if the user has no access to it. */
  async assertCanView(user: AuthUser, id: string): Promise<void> {
    await this.assertExists(id);
    if (user.role === Role.ADMIN) return;

    const visible = await this.prisma.class.count({
      where: { id, ...this.visibleTo(user) },
    });
    if (visible === 0) {
      throw new ForbiddenException(
        user.role === Role.STUDENT
          ? 'You are not enrolled in this class'
          : 'You are not assigned to this class',
      );
    }
  }

  async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.class.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Class not found');
  }

  private async assertTeacherExists(teacherId: string): Promise<void> {
    const exists = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Teacher not found');
  }

  private async assertNameIsFree(
    schoolYearId: string,
    name: string,
    exceptId?: string,
  ) {
    const existing = await this.prisma.class.findFirst({
      where: {
        schoolYearId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'A class with this name already exists this school year',
      );
    }
  }
}

function toClassDto(schoolClass: ClassRow): ClassDto {
  return {
    id: schoolClass.id,
    name: schoolClass.name,
    gradeLevel: gradeLevel(schoolClass.name),
    schoolYear: {
      id: schoolClass.schoolYear.id,
      name: yearName(schoolClass.schoolYear.startYear),
      status: schoolClass.schoolYear.status,
    },
    homeroomTeacher: toPerson(schoolClass.homeroomTeacher),
    studentCount: schoolClass._count.enrollments,
    createdAt: schoolClass.createdAt,
  };
}
