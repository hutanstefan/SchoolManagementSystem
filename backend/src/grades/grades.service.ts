import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthUser } from '../auth/auth.types';
import { ClassesService } from '../classes/classes.service';
import { todayInSchool, toDateString } from '../common/dates';
import {
  PersonSummaryDto,
  SubjectSummaryDto,
} from '../common/dto/summaries.dto';
import { Paginated, pageArgs, paginated } from '../common/dto/pagination.dto';
import {
  personSelect,
  subjectSummarySelect,
  toPerson,
} from '../common/mappers';
import {
  DomainEvents,
  type GradeChange,
  type GradesChangedEvent,
} from '../events/domain-events';
import {
  GradeAction,
  Prisma,
  Role,
  SchoolYearStatus,
} from '../generated/prisma/client';
import type { AbsenceCountDto } from '../absences/dto/absence.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodQueryDto } from '../school-years/dto/school-year.dto';
import { yearResult } from '../school-years/promotion';
import {
  nextClassName,
  schoolYearSelect,
  type SchoolYearRow,
  type Semester,
} from '../school-years/school-year';
import {
  SchoolYearsService,
  toSchoolYearDto,
  type Period,
} from '../school-years/school-years.service';
import { minimumGrades, overallAverage, subjectAverage } from './averages';
import {
  CreateGradeDto,
  CreateGradesBatchDto,
  GradebookDto,
  GradeDto,
  GradeEntryDto,
  GradeHistoryEntryDto,
  GradeQueryDto,
  GradesBatchResultDto,
  StudentGradesReportDto,
  StudentYearReportDto,
  SubjectGradesDto,
  UpdateGradeDto,
} from './dto/grade.dto';

const gradeSelect = {
  id: true,
  value: true,
  date: true,
  schoolYearId: true,
  semester: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      ...personSelect,
      enrollments: {
        select: {
          schoolYearId: true,
          class: { select: { id: true, name: true } },
        },
      },
    },
  },
  subject: { select: subjectSummarySelect },
  teacher: { select: personSelect },
} as const satisfies Prisma.GradeSelect;

type GradeRow = Prisma.GradeGetPayload<{ select: typeof gradeSelect }>;

const gradeEntrySelect = {
  id: true,
  value: true,
  date: true,
  subjectId: true,
  studentId: true,
  teacher: { select: personSelect },
} as const satisfies Prisma.GradeSelect;

type GradeEntryRow = Prisma.GradeGetPayload<{
  select: typeof gradeEntrySelect;
}>;

/**
 * Grades: each one counts for a school year and a semester. New grades go to
 * the open year; teachers write in the current semester only, admins can
 * also correct an ended one; a closed year is read-only.
 */
@Injectable()
export class GradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly events: EventEmitter2,
    private readonly years: SchoolYearsService,
  ) {}

  /** Tells whoever listens (notifications) that grades changed. */
  private async publish(
    user: AuthUser,
    subjectId: string,
    period: { schoolYearId: string; semester: number },
    changes: GradeChange[],
  ): Promise<void> {
    if (changes.length === 0) return;
    const event: GradesChangedEvent = {
      actorId: user.id,
      subjectId,
      schoolYearId: period.schoolYearId,
      semester: period.semester,
      changes,
    };
    await this.events.emitAsync(DomainEvents.GradesChanged, event);
  }

  // ---------------------------------------------------------------- writes

  /**
   * Teachers can only grade a subject they teach, in that student's class.
   * Admins can grade any student; the grade is attributed to the subject's teacher.
   */
  async create(user: AuthUser, dto: CreateGradeDto): Promise<GradeDto> {
    const year = await this.years.active();
    const semester = dto.semester ?? (year.currentSemester as Semester);
    this.years.assertGradesWritable(user, year, semester);

    const [student, subject] = await Promise.all([
      this.prisma.student.findUnique({
        where: { id: dto.studentId },
        select: { id: true },
      }),
      this.prisma.subject.findUnique({
        where: { id: dto.subjectId },
        select: { name: true },
      }),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    if (!subject) throw new NotFoundException('Subject not found');
    const schoolClass = await this.years.classOf(dto.studentId, year.id);
    if (!schoolClass) {
      throw new BadRequestException(
        'The student is not enrolled in a class this school year',
      );
    }

    const assignment = await this.prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: schoolClass.id,
          subjectId: dto.subjectId,
        },
      },
      select: { teacher: { select: { id: true, userId: true } } },
    });
    if (!assignment) {
      throw new BadRequestException(
        `${subject.name} is not taught in ${schoolClass.name}`,
      );
    }
    if (user.role === Role.TEACHER && assignment.teacher?.userId !== user.id) {
      throw new ForbiddenException(
        `You don't teach ${subject.name} in ${schoolClass.name}`,
      );
    }

    const date = new Date(dto.date ?? todayInSchool());

    // The grade and its audit entry are written together or not at all.
    const grade = await this.prisma.$transaction(async (tx) => {
      const created = await tx.grade.create({
        data: {
          studentId: dto.studentId,
          subjectId: dto.subjectId,
          teacherId: assignment.teacher?.id ?? null,
          schoolYearId: year.id,
          semester,
          value: dto.value,
          date,
        },
        select: gradeSelect,
      });
      await tx.gradeHistory.create({
        data: {
          gradeId: created.id,
          studentId: dto.studentId,
          subjectId: dto.subjectId,
          action: GradeAction.CREATED,
          newValue: dto.value,
          newDate: date,
          changedById: user.id,
        },
      });
      return created;
    });
    await this.publish(
      user,
      dto.subjectId,
      { schoolYearId: year.id, semester },
      [
        {
          kind: 'created',
          gradeId: grade.id,
          studentId: dto.studentId,
          value: grade.value,
          date: toDateString(date),
        },
      ],
    );
    return toGradeDto(grade);
  }

  /**
   * Grades for many students in one subject, e.g. read from photos of tests
   * or from a spreadsheet. With a class, every student must be in it; without
   * one (an import for several classes), the user must be allowed to grade
   * the subject in each student's class of the open year. Saved together or
   * not at all: one invalid entry rejects the whole batch.
   */
  async createMany(
    user: AuthUser,
    classId: string | null,
    dto: CreateGradesBatchDto,
  ): Promise<GradesBatchResultDto> {
    const classCheck = classId
      ? await this.assertCanGrade(user, classId, dto.subjectId)
      : null;
    const year = classCheck?.schoolYear ?? (await this.years.active());
    const semester = dto.semester ?? (year.currentSemester as Semester);
    this.years.assertGradesWritable(user, year, semester);

    const studentIds = dto.grades.map((g) => g.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException(
        'Each student can appear only once in a batch',
      );
    }
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        enrollments: {
          where: { schoolYearId: year.id },
          select: { classId: true },
        },
      },
    });
    const classOf = new Map(
      students.map((s) => [s.id, s.enrollments[0]?.classId ?? null]),
    );

    // The teacher each grade is attributed to: the subject's teacher in the
    // student's class.
    const teacherByClass = new Map<string, string | null>();
    if (classId && classCheck) {
      const outside = studentIds.filter((id) => classOf.get(id) !== classId);
      if (outside.length > 0) {
        throw new BadRequestException(
          `${outside.length} of the students are not in ${classCheck.className}`,
        );
      }
      teacherByClass.set(classId, classCheck.teacherId);
    } else {
      if (students.length !== studentIds.length) {
        throw new BadRequestException(
          `${studentIds.length - students.length} of the students don't exist`,
        );
      }
      if ([...classOf.values()].some((id) => id === null)) {
        throw new BadRequestException(
          'Every student must be enrolled in a class this school year',
        );
      }
      for (const id of new Set([...classOf.values()] as string[])) {
        const { teacherId } = await this.assertCanGrade(
          user,
          id,
          dto.subjectId,
        );
        teacherByClass.set(id, teacherId);
      }
    }
    const teacherOf = (studentId: string) =>
      teacherByClass.get(classOf.get(studentId)!) ?? null;

    const replacements = await this.findReplacements(user, dto, {
      schoolYearId: year.id,
      semester,
    });
    const batchDate = dto.date ?? todayInSchool();

    const saved = await this.prisma.$transaction(async (tx) => {
      const ids = new Map<number, string>();

      // New grades, in one statement.
      const toCreate = dto.grades
        .map((g, index) => ({ g, index }))
        .filter(({ g }) => !g.replaceGradeId);
      const created = await tx.grade.createManyAndReturn({
        data: toCreate.map(({ g }) => ({
          studentId: g.studentId,
          subjectId: dto.subjectId,
          teacherId: teacherOf(g.studentId),
          schoolYearId: year.id,
          semester,
          value: g.value,
          date: new Date(g.date ?? batchDate),
        })),
        select: { id: true, studentId: true, value: true, date: true },
      });
      // createManyAndReturn keeps the input order on PostgreSQL.
      created.forEach((grade, i) => ids.set(toCreate[i].index, grade.id));
      await tx.gradeHistory.createMany({
        data: created.map((grade) => ({
          gradeId: grade.id,
          studentId: grade.studentId,
          subjectId: dto.subjectId,
          action: GradeAction.CREATED,
          newValue: grade.value,
          newDate: grade.date,
          changedById: user.id,
        })),
      });

      // Replaced grades: new value and date, the old ones go to the history.
      for (const [index, g] of dto.grades.entries()) {
        if (!g.replaceGradeId) continue;
        const old = replacements.get(g.replaceGradeId)!;
        const date = new Date(g.date ?? batchDate);
        await tx.grade.update({
          where: { id: g.replaceGradeId },
          data: { value: g.value, date },
        });
        await tx.gradeHistory.create({
          data: {
            gradeId: g.replaceGradeId,
            studentId: g.studentId,
            subjectId: dto.subjectId,
            action: GradeAction.UPDATED,
            oldValue: old.value,
            newValue: g.value,
            oldDate: old.date,
            newDate: date,
            changedById: user.id,
          },
        });
        ids.set(index, g.replaceGradeId);
      }
      return dto.grades.map((_, index) => ids.get(index)!);
    });

    await this.publish(
      user,
      dto.subjectId,
      { schoolYearId: year.id, semester },
      dto.grades.map((g, index) => {
        const date = g.date ?? batchDate;
        const old = g.replaceGradeId
          ? replacements.get(g.replaceGradeId)
          : null;
        return old
          ? {
              kind: 'updated' as const,
              gradeId: saved[index],
              studentId: g.studentId,
              value: g.value,
              date,
              oldValue: old.value,
              oldDate: toDateString(old.date),
            }
          : {
              kind: 'created' as const,
              gradeId: saved[index],
              studentId: g.studentId,
              value: g.value,
              date,
            };
      }),
    );
    return {
      count: saved.length,
      replaced: replacements.size,
      gradeIds: saved,
    };
  }

  /**
   * The grades a batch wants to replace: each must exist, belong to that
   * student, subject and semester, and (for a teacher) have been given by them.
   */
  private async findReplacements(
    user: AuthUser,
    dto: CreateGradesBatchDto,
    period: { schoolYearId: string; semester: number },
  ): Promise<Map<string, { value: number; date: Date }>> {
    const wanted = dto.grades.filter((g) => g.replaceGradeId);
    const ids = wanted.map((g) => g.replaceGradeId!);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A grade can be replaced only once');
    }
    if (ids.length === 0) return new Map();

    const grades = await this.prisma.grade.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        value: true,
        date: true,
        studentId: true,
        subjectId: true,
        schoolYearId: true,
        semester: true,
        teacher: { select: { userId: true } },
      },
    });
    const byId = new Map(grades.map((g) => [g.id, g]));
    for (const entry of wanted) {
      const grade = byId.get(entry.replaceGradeId!);
      if (
        !grade ||
        grade.studentId !== entry.studentId ||
        grade.subjectId !== dto.subjectId ||
        grade.schoolYearId !== period.schoolYearId ||
        grade.semester !== period.semester
      ) {
        throw new BadRequestException(
          "A grade to replace doesn't exist or belongs to another student, subject or semester",
        );
      }
      if (user.role === Role.TEACHER && grade.teacher?.userId !== user.id) {
        throw new ForbiddenException('You can only change grades you gave');
      }
    }
    return new Map(grades.map((g) => [g.id, { value: g.value, date: g.date }]));
  }

  /**
   * Checks that the user may grade a subject in a class: the class's year
   * must be open; admins always, a teacher only a subject they teach there.
   */
  async assertCanGrade(
    user: AuthUser,
    classId: string,
    subjectId: string,
  ): Promise<{
    className: string;
    subjectName: string;
    subject: SubjectSummaryDto;
    teacherId: string | null;
    schoolYear: SchoolYearRow;
  }> {
    const [schoolClass, subject] = await Promise.all([
      this.prisma.class.findUnique({
        where: { id: classId },
        select: { name: true, schoolYear: { select: schoolYearSelect } },
      }),
      this.prisma.subject.findUnique({
        where: { id: subjectId },
        select: subjectSummarySelect,
      }),
    ]);
    if (!schoolClass) throw new NotFoundException('Class not found');
    if (!subject) throw new NotFoundException('Subject not found');
    this.years.assertOpen(schoolClass.schoolYear);

    const assignment = await this.prisma.classSubject.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
      select: { teacher: { select: { id: true, userId: true } } },
    });
    if (!assignment) {
      throw new BadRequestException(
        `${subject.name} is not taught in ${schoolClass.name}`,
      );
    }
    if (user.role === Role.TEACHER && assignment.teacher?.userId !== user.id) {
      throw new ForbiddenException(
        `You don't teach ${subject.name} in ${schoolClass.name}`,
      );
    }
    return {
      className: schoolClass.name,
      subjectName: subject.name,
      subject,
      teacherId: assignment.teacher?.id ?? null,
      schoolYear: schoolClass.schoolYear,
    };
  }

  /** Teachers can only change grades they gave themselves. */
  async update(
    user: AuthUser,
    id: string,
    dto: UpdateGradeDto,
  ): Promise<GradeDto> {
    const current = await this.findForChange(user, id);

    const newValue = dto.value ?? current.value;
    const newDate = dto.date ? new Date(dto.date) : current.date;
    const changed =
      newValue !== current.value ||
      toDateString(newDate) !== toDateString(current.date);

    if (!changed) {
      return toGradeDto(
        await this.prisma.grade.findUniqueOrThrow({
          where: { id },
          select: gradeSelect,
        }),
      );
    }

    const grade = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.grade.update({
        where: { id },
        data: { value: newValue, date: newDate },
        select: gradeSelect,
      });
      await tx.gradeHistory.create({
        data: {
          gradeId: id,
          studentId: current.studentId,
          subjectId: current.subjectId,
          action: GradeAction.UPDATED,
          oldValue: current.value,
          newValue,
          oldDate: current.date,
          newDate,
          changedById: user.id,
        },
      });
      return updated;
    });
    await this.publish(user, current.subjectId, current, [
      {
        kind: 'updated',
        gradeId: id,
        studentId: current.studentId,
        value: newValue,
        date: toDateString(newDate),
        oldValue: current.value,
        oldDate: toDateString(current.date),
      },
    ]);
    return toGradeDto(grade);
  }

  /** Teachers can only delete grades they gave. The history keeps a record. */
  async remove(user: AuthUser, id: string): Promise<void> {
    const current = await this.findForChange(user, id);

    await this.prisma.$transaction([
      this.prisma.gradeHistory.create({
        data: {
          gradeId: id,
          studentId: current.studentId,
          subjectId: current.subjectId,
          action: GradeAction.DELETED,
          oldValue: current.value,
          oldDate: current.date,
          changedById: user.id,
        },
      }),
      this.prisma.grade.delete({ where: { id } }),
    ]);
    await this.publish(user, current.subjectId, current, [
      {
        kind: 'deleted',
        gradeId: id,
        studentId: current.studentId,
        value: current.value,
        date: toDateString(current.date),
      },
    ]);
  }

  // ----------------------------------------------------------------- reads

  /**
   * Paginated grades of a school year and semester. Admins see everything.
   * Teachers see the grades of the subjects they teach in each class, every
   * grade of their homeroom classes, and every grade they gave themselves.
   */
  async findAll(
    user: AuthUser,
    query: GradeQueryDto,
  ): Promise<Paginated<GradeDto>> {
    const { year, semester } = await this.years.resolvePeriod(query);
    const filters: Prisma.GradeWhereInput[] = [
      { schoolYearId: year.id, semester },
      query.classId
        ? { student: { enrollments: { some: { classId: query.classId } } } }
        : {},
      query.subjectId ? { subjectId: query.subjectId } : {},
      query.studentId ? { studentId: query.studentId } : {},
      query.search
        ? {
            student: {
              user: {
                OR: [
                  {
                    firstName: { contains: query.search, mode: 'insensitive' },
                  },
                  { lastName: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            },
          }
        : {},
    ];
    if (user.role === Role.TEACHER) {
      filters.push(await this.teacherScope(user.id, year.id));
    }
    const where: Prisma.GradeWhereInput = { AND: filters };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.grade.findMany({
        where,
        select: gradeSelect,
        orderBy: [{ [query.sort]: query.order }, { createdAt: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.grade.count({ where }),
    ]);
    return paginated(rows.map(toGradeDto), total, query);
  }

  /** The logged-in student's own report card for a semester. */
  async myReport(
    user: AuthUser,
    query: PeriodQueryDto,
  ): Promise<StudentGradesReportDto> {
    const studentId = await this.studentIdOf(user);
    return this.buildReport(studentId, await this.years.resolvePeriod(query));
  }

  /** The logged-in student's whole year: both semesters and annual averages. */
  async myYear(
    user: AuthUser,
    schoolYearId?: string,
  ): Promise<StudentYearReportDto> {
    const studentId = await this.studentIdOf(user);
    return this.buildYearReport(
      studentId,
      await this.years.resolveYear(schoolYearId),
    );
  }

  /** A student's report card, for admins and the teachers of their class. */
  async studentReport(
    user: AuthUser,
    studentId: string,
    query: PeriodQueryDto,
  ): Promise<StudentGradesReportDto> {
    const period = await this.years.resolvePeriod(query);
    await this.assertCanSeeStudent(user, studentId, period.year.id);
    return this.buildReport(studentId, period);
  }

  /** A student's whole year, for admins and the teachers of their class. */
  async studentYear(
    user: AuthUser,
    studentId: string,
    schoolYearId?: string,
  ): Promise<StudentYearReportDto> {
    const year = await this.years.resolveYear(schoolYearId);
    await this.assertCanSeeStudent(user, studentId, year.id);
    return this.buildYearReport(studentId, year);
  }

  /**
   * The gradebook of one subject in one class, for a semester of the class's
   * year. Open to admins, to the teacher of that subject and to the class's
   * homeroom teacher.
   */
  async gradebook(
    user: AuthUser,
    classId: string,
    subjectId: string,
    semester?: Semester,
  ): Promise<GradebookDto> {
    const schoolClass = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        schoolYear: { select: schoolYearSelect },
        homeroomTeacher: { select: { userId: true } },
      },
    });
    if (!schoolClass) throw new NotFoundException('Class not found');
    const { year, semester: shown } = await this.years.resolvePeriod({
      schoolYearId: schoolClass.schoolYear.id,
      semester,
    });

    const assignment = await this.prisma.classSubject.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
      select: {
        hoursPerWeek: true,
        maxAbsences: true,
        subject: { select: subjectSummarySelect },
        teacher: { select: { ...personSelect, userId: true } },
      },
    });
    if (!assignment) {
      throw new NotFoundException('This subject is not taught in this class');
    }

    const teachesIt = assignment.teacher?.userId === user.id;
    if (
      user.role === Role.TEACHER &&
      !teachesIt &&
      schoolClass.homeroomTeacher?.userId !== user.id
    ) {
      throw new ForbiddenException(
        `You don't teach ${assignment.subject.name} in ${schoolClass.name}`,
      );
    }

    const students = await this.prisma.student.findMany({
      where: { enrollments: { some: { classId } } },
      select: { ...personSelect, registrationNumber: true },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
    const grades = await this.prisma.grade.findMany({
      where: {
        subjectId,
        schoolYearId: year.id,
        semester: shown,
        studentId: { in: students.map((s) => s.id) },
      },
      select: gradeEntrySelect,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    const absences = await this.absenceCounts(
      students.map((s) => s.id),
      { schoolYearId: year.id, semester: shown, subjectId },
    );

    const writable =
      year.status === SchoolYearStatus.ACTIVE &&
      (user.role === Role.ADMIN ||
        (teachesIt && shown === year.currentSemester));
    const minimum = minimumGrades(assignment.hoursPerWeek);
    return {
      class: { id: schoolClass.id, name: schoolClass.name },
      period: { schoolYear: toSchoolYearDto(year), semester: shown },
      readOnly: !writable,
      subject: assignment.subject,
      teacher: toPerson(assignment.teacher),
      hoursPerWeek: assignment.hoursPerWeek,
      minimumGrades: minimum,
      maxAbsences: assignment.maxAbsences,
      // Attendance is taken in the current semester (admins: any).
      canTakeAttendance: writable,
      students: students.map((student) => {
        const own = grades.filter((g) => g.studentId === student.id);
        return {
          student: toPerson(student),
          registrationNumber: student.registrationNumber,
          grades: own.map(toGradeEntry),
          ...subjectAverage(own.map((g) => g.value)),
          hasMinimumGrades: own.length >= minimum,
          absences: absences(student.id),
        };
      }),
    };
  }

  /** Each student's absences (unexcused, excused) in one subject and semester. */
  private async absenceCounts(
    studentIds: string[],
    where: { schoolYearId: string; semester: number; subjectId: string },
  ): Promise<(studentId: string) => AbsenceCountDto> {
    const rows = await this.prisma.absence.groupBy({
      by: ['studentId', 'excused'],
      where: { ...where, studentId: { in: studentIds } },
      _count: { _all: true },
    });
    const count = (studentId: string, excused: boolean) =>
      rows.find((r) => r.studentId === studentId && r.excused === excused)
        ?._count._all ?? 0;
    return (studentId) => ({
      unexcused: count(studentId, false),
      excused: count(studentId, true),
    });
  }

  /** Audit trail of one grade, still available after the grade is deleted. */
  async history(gradeId: string): Promise<GradeHistoryEntryDto[]> {
    const entries = await this.prisma.gradeHistory.findMany({
      where: { gradeId },
      orderBy: { changedAt: 'asc' },
      select: {
        id: true,
        gradeId: true,
        action: true,
        oldValue: true,
        newValue: true,
        oldDate: true,
        newDate: true,
        changedAt: true,
        changedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });
    if (entries.length === 0) throw new NotFoundException('Grade not found');

    return entries.map((entry) => ({
      ...entry,
      oldDate: entry.oldDate ? toDateString(entry.oldDate) : null,
      newDate: entry.newDate ? toDateString(entry.newDate) : null,
    }));
  }

  // --------------------------------------------------------------- helpers

  private async studentIdOf(user: AuthUser): Promise<string> {
    const student = await this.prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return student.id;
  }

  /** Admins see every student; teachers the students of their classes that year. */
  private async assertCanSeeStudent(
    user: AuthUser,
    studentId: string,
    schoolYearId: string,
  ): Promise<void> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (user.role !== Role.TEACHER) return;

    const schoolClass = await this.years.classOf(studentId, schoolYearId);
    if (!schoolClass) {
      throw new ForbiddenException('You are not assigned to this student');
    }
    await this.classes.assertCanView(user, schoolClass.id);
  }

  /**
   * A grade that may be changed: in the open year, in the current semester
   * (admins: also an ended one), and for a teacher, one they gave.
   */
  private async findForChange(user: AuthUser, id: string) {
    const grade = await this.prisma.grade.findUnique({
      where: { id },
      select: {
        value: true,
        date: true,
        studentId: true,
        subjectId: true,
        schoolYearId: true,
        semester: true,
        schoolYear: { select: schoolYearSelect },
        teacher: { select: { userId: true } },
      },
    });
    if (!grade) throw new NotFoundException('Grade not found');
    if (user.role === Role.TEACHER && grade.teacher?.userId !== user.id) {
      throw new ForbiddenException('You can only change grades you gave');
    }
    this.years.assertGradesWritable(user, grade.schoolYear, grade.semester);
    return grade;
  }

  /** Grades a teacher may see in a school year (see findAll). */
  private async teacherScope(
    userId: string,
    schoolYearId: string,
  ): Promise<Prisma.GradeWhereInput> {
    const [assignments, homeroomClasses] = await Promise.all([
      this.prisma.classSubject.findMany({
        where: { teacher: { userId }, class: { schoolYearId } },
        select: { classId: true, subjectId: true },
      }),
      this.prisma.class.findMany({
        where: { homeroomTeacher: { userId }, schoolYearId },
        select: { id: true },
      }),
    ]);
    const inClass = (classId: string) => ({
      student: { enrollments: { some: { classId } } },
    });

    return {
      OR: [
        ...assignments.map((a) => ({
          subjectId: a.subjectId,
          ...inClass(a.classId),
        })),
        ...homeroomClasses.map((c) => inClass(c.id)),
        { teacher: { userId } },
      ],
    };
  }

  /** The student, with their class of that year and its subjects. */
  private async studentInYear(studentId: string, schoolYearId: string) {
    const student = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      select: {
        ...personSelect,
        registrationNumber: true,
        enrollments: {
          where: { schoolYearId },
          select: {
            outcome: true,
            class: {
              select: {
                id: true,
                name: true,
                subjects: {
                  select: {
                    hoursPerWeek: true,
                    maxAbsences: true,
                    subject: { select: subjectSummarySelect },
                    teacher: { select: personSelect },
                  },
                },
              },
            },
          },
        },
      },
    });
    const enrollment = student.enrollments[0] ?? null;
    return { student, enrollment, schoolClass: enrollment?.class ?? null };
  }

  private async buildReport(
    studentId: string,
    { year, semester }: Period,
  ): Promise<StudentGradesReportDto> {
    const { student, schoolClass } = await this.studentInYear(
      studentId,
      year.id,
    );
    const grades = await this.prisma.grade.findMany({
      where: { studentId, schoolYearId: year.id, semester },
      select: {
        ...gradeEntrySelect,
        subject: { select: subjectSummarySelect },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    // Subjects of the class, plus any subject graded in another class that year.
    const classSubjects = schoolClass?.subjects ?? [];
    const subjectIds = new Set(classSubjects.map((cs) => cs.subject.id));
    const extraSubjects = [
      ...new Map(
        grades
          .filter((g) => !subjectIds.has(g.subjectId))
          .map((g) => [g.subjectId, g.subject]),
      ).values(),
    ];

    const reportSubjects: {
      subject: (typeof extraSubjects)[number];
      teacher: PersonSummaryDto | null;
      hoursPerWeek: number | null;
      maxAbsences: number | null;
    }[] = [
      ...classSubjects.map((cs) => ({
        subject: cs.subject,
        teacher: toPerson(cs.teacher),
        hoursPerWeek: cs.hoursPerWeek,
        maxAbsences: cs.maxAbsences,
      })),
      ...extraSubjects.map((subject) => ({
        subject,
        teacher: null,
        hoursPerWeek: null,
        maxAbsences: null,
      })),
    ];
    const absences = await this.prisma.absence.groupBy({
      by: ['subjectId', 'excused'],
      where: { studentId, schoolYearId: year.id, semester },
      _count: { _all: true },
    });
    const absencesIn = (subjectId: string, excused: boolean) =>
      absences.find((a) => a.subjectId === subjectId && a.excused === excused)
        ?._count._all ?? 0;

    const subjects: SubjectGradesDto[] = reportSubjects
      .sort((a, b) => a.subject.name.localeCompare(b.subject.name))
      .map(({ subject, teacher, hoursPerWeek, maxAbsences }) => {
        const own = grades.filter((g) => g.subjectId === subject.id);
        const minimum =
          hoursPerWeek === null ? null : minimumGrades(hoursPerWeek);
        return {
          subject,
          teacher,
          grades: own.map(toGradeEntry),
          ...subjectAverage(own.map((g) => g.value)),
          minimumGrades: minimum,
          hasMinimumGrades: minimum === null ? null : own.length >= minimum,
          absences: {
            unexcused: absencesIn(subject.id, false),
            excused: absencesIn(subject.id, true),
          },
          maxAbsences,
        };
      });

    return {
      student: toPerson(student),
      registrationNumber: student.registrationNumber,
      period: { schoolYear: toSchoolYearDto(year), semester },
      class: schoolClass
        ? { id: schoolClass.id, name: schoolClass.name }
        : null,
      subjects,
      overallAverage: overallAverage(subjects.map((s) => s.roundedAverage)),
    };
  }

  private async buildYearReport(
    studentId: string,
    year: SchoolYearRow,
  ): Promise<StudentYearReportDto> {
    const { student, enrollment, schoolClass } = await this.studentInYear(
      studentId,
      year.id,
    );
    const [grades, reexams] = await Promise.all([
      this.prisma.grade.findMany({
        where: { studentId, schoolYearId: year.id },
        select: {
          semester: true,
          value: true,
          subject: { select: subjectSummarySelect },
        },
      }),
      this.prisma.reexam.findMany({
        where: { studentId, schoolYearId: year.id },
        select: { subjectId: true, grade: true },
      }),
    ]);
    const subjects = new Map(
      [
        ...(schoolClass?.subjects.map((s) => s.subject) ?? []),
        ...grades.map((g) => g.subject),
      ].map((s) => [s.id, s]),
    );
    const result = yearResult(
      [...subjects.keys()].map((subjectId) => ({
        subjectId,
        semester1: grades
          .filter((g) => g.subject.id === subjectId && g.semester === 1)
          .map((g) => g.value),
        semester2: grades
          .filter((g) => g.subject.id === subjectId && g.semester === 2)
          .map((g) => g.value),
        reexamGrade:
          reexams.find((r) => r.subjectId === subjectId)?.grade ?? null,
      })),
      schoolClass ? nextClassName(schoolClass.name) === null : false,
    );

    return {
      student: toPerson(student),
      registrationNumber: student.registrationNumber,
      schoolYear: toSchoolYearDto(year),
      class: schoolClass
        ? { id: schoolClass.id, name: schoolClass.name }
        : null,
      subjects: result.subjects
        .map(({ subjectId, ...rest }) => ({
          subject: subjects.get(subjectId)!,
          ...rest,
        }))
        .sort((a, b) => a.subject.name.localeCompare(b.subject.name)),
      generalAverage: result.generalAverage,
      outcome: enrollment?.outcome ?? null,
    };
  }
}

function toGradeEntry(row: GradeEntryRow): GradeEntryDto {
  return {
    id: row.id,
    value: row.value,
    date: toDateString(row.date),
    teacher: toPerson(row.teacher),
  };
}

function toGradeDto(row: GradeRow): GradeDto {
  return {
    id: row.id,
    value: row.value,
    date: toDateString(row.date),
    student: toPerson(row.student),
    class:
      row.student.enrollments.find((e) => e.schoolYearId === row.schoolYearId)
        ?.class ?? null,
    subject: row.subject,
    schoolYearId: row.schoolYearId,
    semester: row.semester as Semester,
    teacher: toPerson(row.teacher),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
