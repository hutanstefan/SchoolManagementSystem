import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { compareClassNames } from '../classes/class-names';
import { subjectSummarySelect } from '../common/mappers';
import {
  Prisma,
  Role,
  SchoolYearStatus,
  YearOutcome,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ClosingPreviewDto,
  CloseYearDto,
  CloseYearResultDto,
  OutcomeCountsDto,
  PeriodQueryDto,
  SaveReexamDto,
  SchoolYearDto,
  SchoolYearSummaryDto,
} from './dto/school-year.dto';
import { yearResult, type SuggestedOutcome } from './promotion';
import {
  FINAL_GRADE_LEVEL,
  gradeLevel,
  nextClassName,
  schoolYearSelect,
  yearName,
  type SchoolYearRow,
  type Semester,
} from './school-year';

export interface Period {
  year: SchoolYearRow;
  semester: Semester;
}

type Tx = Prisma.TransactionClient;

/**
 * School years and their two semesters: which one is open, the read-only
 * archive of the closed ones, and the end of a semester or a year (with the
 * promotion of the students to next year's classes).
 */
@Injectable()
export class SchoolYearsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------- lookups

  /** The open school year. There is always one (the migration creates it). */
  async active(tx: Tx | PrismaService = this.prisma): Promise<SchoolYearRow> {
    const year = await tx.schoolYear.findFirst({
      where: { status: SchoolYearStatus.ACTIVE },
      select: schoolYearSelect,
      orderBy: { startYear: 'desc' },
    });
    if (!year) throw new ConflictException('No school year is open');
    return year;
  }

  async find(id: string): Promise<SchoolYearRow> {
    const year = await this.prisma.schoolYear.findUnique({
      where: { id },
      select: schoolYearSelect,
    });
    if (!year) throw new NotFoundException('School year not found');
    return year;
  }

  /** The requested school year, or the open one. */
  resolveYear(schoolYearId?: string): Promise<SchoolYearRow> {
    return schoolYearId ? this.find(schoolYearId) : this.active();
  }

  /**
   * The requested year and semester. By default the open year and its
   * current semester; a closed year shows its second semester.
   */
  async resolvePeriod(query: PeriodQueryDto): Promise<Period> {
    const year = await this.resolveYear(query.schoolYearId);
    const semester =
      query.semester ??
      (year.status === SchoolYearStatus.CLOSED
        ? 2
        : (year.currentSemester as Semester));
    if (
      year.status === SchoolYearStatus.ACTIVE &&
      semester > year.currentSemester
    ) {
      throw new BadRequestException(
        `Semester ${semester} of ${yearName(year.startYear)} hasn't started yet`,
      );
    }
    return { year, semester };
  }

  /** A closed year is an archive: nothing in it can change. */
  assertOpen(year: Pick<SchoolYearRow, 'status' | 'startYear'>): void {
    if (year.status === SchoolYearStatus.CLOSED) {
      throw new ConflictException(
        `${yearName(year.startYear)} is closed: its data can only be viewed`,
      );
    }
  }

  /** The class's school year, which must be open. 404 for an unknown class. */
  async assertClassOpen(classId: string): Promise<SchoolYearRow> {
    const schoolClass = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { schoolYear: { select: schoolYearSelect } },
    });
    if (!schoolClass) throw new NotFoundException('Class not found');
    this.assertOpen(schoolClass.schoolYear);
    return schoolClass.schoolYear;
  }

  /**
   * Grades can be written in the open year, in the current semester or an
   * earlier one. Only admins can change an ended semester.
   */
  assertGradesWritable(
    user: AuthUser,
    year: SchoolYearRow,
    semester: number,
  ): void {
    this.assertOpen(year);
    if (semester > year.currentSemester) {
      throw new BadRequestException(`Semester ${semester} hasn't started yet`);
    }
    if (user.role !== Role.ADMIN && semester < year.currentSemester) {
      throw new ForbiddenException(
        `Semester ${semester} has ended: only an administrator can change its grades`,
      );
    }
  }

  /** The class a student is in, in a school year (null if none). */
  async classOf(
    studentId: string,
    schoolYearId: string,
  ): Promise<{ id: string; name: string } | null> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_schoolYearId: { studentId, schoolYearId } },
      select: { class: { select: { id: true, name: true } } },
    });
    return enrollment?.class ?? null;
  }

  toDto(year: SchoolYearRow): SchoolYearDto {
    return toSchoolYearDto(year);
  }

  // ---------------------------------------------------------------- list

  /**
   * The years a user can look at: all of them for admins; for teachers and
   * students, the years they had classes in, and the open one.
   */
  async list(user: AuthUser): Promise<SchoolYearSummaryDto[]> {
    const mine: Prisma.SchoolYearWhereInput =
      user.role === Role.TEACHER
        ? {
            classes: {
              some: {
                OR: [
                  { homeroomTeacher: { userId: user.id } },
                  { subjects: { some: { teacher: { userId: user.id } } } },
                ],
              },
            },
          }
        : user.role === Role.STUDENT
          ? { enrollments: { some: { student: { userId: user.id } } } }
          : {};
    const years = await this.prisma.schoolYear.findMany({
      where:
        user.role === Role.ADMIN
          ? {}
          : { OR: [mine, { status: SchoolYearStatus.ACTIVE }] },
      select: {
        ...schoolYearSelect,
        _count: { select: { classes: true, enrollments: true } },
      },
      orderBy: { startYear: 'desc' },
    });
    const outcomes = await this.prisma.enrollment.groupBy({
      by: ['schoolYearId', 'outcome'],
      where: {
        schoolYearId: { in: years.map((y) => y.id) },
        outcome: { not: null },
      },
      _count: { _all: true },
    });

    return years.map((year) => {
      const counts = outcomes.filter((o) => o.schoolYearId === year.id);
      const count = (outcome: YearOutcome) =>
        counts.find((c) => c.outcome === outcome)?._count._all ?? 0;
      return {
        ...toSchoolYearDto(year),
        classCount: year._count.classes,
        studentCount: year._count.enrollments,
        outcomes:
          year.status === SchoolYearStatus.CLOSED
            ? {
                promoted: count(YearOutcome.PROMOTED),
                repeating: count(YearOutcome.REPEATING),
                graduated: count(YearOutcome.GRADUATED),
              }
            : null,
      };
    });
  }

  // -------------------------------------------------------------- semester

  /** Ends the first semester: new grades go to the second one. */
  async endSemester(): Promise<SchoolYearDto> {
    const year = await this.active();
    if (year.currentSemester !== 1) {
      throw new ConflictException(
        'The second semester has already started: close the school year instead',
      );
    }
    const updated = await this.prisma.schoolYear.update({
      where: { id: year.id },
      data: { currentSemester: 2, semester1EndedAt: new Date() },
      select: schoolYearSelect,
    });
    return toSchoolYearDto(updated);
  }

  // ------------------------------------------------------------ the year

  /**
   * Every student of the open year with their annual results and what the
   * rules suggest: promoted, re-exams, repeating or graduated.
   */
  async closingPreview(): Promise<ClosingPreviewDto> {
    const year = await this.active();
    this.assertInSecondSemester(year);
    const classes = await this.yearResults(this.prisma, year);
    return {
      schoolYear: toSchoolYearDto(year),
      nextYearName: yearName(year.startYear + 1),
      classes: classes.map(({ students, ...rest }) => ({
        ...rest,
        students: students.map(({ student, result, subjectsById }) => ({
          id: student.id,
          firstName: student.user.firstName,
          lastName: student.user.lastName,
          registrationNumber: student.registrationNumber,
          generalAverage: result.generalAverage,
          suggestedOutcome: result.suggestedOutcome,
          failedSubjects: result.failedSubjects.map((r) => ({
            subject: subjectsById.get(r.subjectId)!,
            semester1: r.semester1,
            semester2: r.semester2,
            annual: r.annual,
            reexamGrade: r.reexamGrade,
            final: r.final,
            passed: r.passed,
          })),
        })),
      })),
    };
  }

  /** Records (or corrects) the grade of a re-exam. */
  async saveReexam(dto: SaveReexamDto): Promise<void> {
    const year = await this.active();
    this.assertInSecondSemester(year);
    await this.assertNeedsReexam(year, dto.studentId, dto.subjectId);
    await this.prisma.reexam.upsert({
      where: {
        studentId_schoolYearId_subjectId: {
          studentId: dto.studentId,
          schoolYearId: year.id,
          subjectId: dto.subjectId,
        },
      },
      create: {
        studentId: dto.studentId,
        schoolYearId: year.id,
        subjectId: dto.subjectId,
        grade: dto.grade,
      },
      update: { grade: dto.grade },
    });
  }

  async removeReexam(studentId: string, subjectId: string): Promise<void> {
    const year = await this.active();
    const { count } = await this.prisma.reexam.deleteMany({
      where: { studentId, subjectId, schoolYearId: year.id },
    });
    if (count === 0) throw new NotFoundException('Re-exam not found');
  }

  /**
   * Closes the open year and opens the next one, in one transaction:
   *
   * - every student gets their outcome (the rules', or the admin's decision);
   * - each class continues as next year's class ("9A" -> "10A") with the
   *   same homeroom teacher, subjects and teachers, and its promoted students;
   * - students who repeat the year join the class of their grade next year
   *   (created if needed); graduates leave;
   * - optionally, empty first-grade classes are opened for new students.
   *
   * The timetable is not copied: next year's is made from scratch.
   */
  async close(dto: CloseYearDto): Promise<CloseYearResultDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const year = await this.active(tx);
        this.assertInSecondSemester(year);
        const classes = await this.yearResults(tx, year);
        const decisions = new Map(
          dto.decisions.map((d) => [d.studentId, d.outcome]),
        );

        // The outcome of every student, and what is still missing.
        const pending: string[] = [];
        const outcomes: {
          studentId: string;
          enrollmentId: string;
          classId: string;
          outcome: YearOutcome;
        }[] = [];
        for (const schoolClass of classes) {
          for (const {
            student,
            enrollmentId,
            result,
          } of schoolClass.students) {
            const decided = decisions.get(student.id);
            const outcome = decided ?? fromSuggestion(result.suggestedOutcome);
            const name = `${student.user.firstName} ${student.user.lastName}`;
            if (outcome === null) {
              pending.push(`${name} (${schoolClass.class.name})`);
              continue;
            }
            const final = schoolClass.nextClassName === null;
            if (outcome === YearOutcome.GRADUATED && !final) {
              throw new BadRequestException(
                `${name} is not in the final grade and can't graduate`,
              );
            }
            if (outcome === YearOutcome.PROMOTED && final) {
              throw new BadRequestException(
                `${name} is in the final grade: graduated or repeating`,
              );
            }
            outcomes.push({
              studentId: student.id,
              enrollmentId,
              classId: schoolClass.class.id,
              outcome,
            });
          }
        }
        if (pending.length > 0) {
          throw new BadRequestException(
            `Enter the re-exam results or decide for: ${pending.join(', ')}`,
          );
        }

        for (const outcome of Object.values(YearOutcome)) {
          await tx.enrollment.updateMany({
            where: {
              id: {
                in: outcomes
                  .filter((o) => o.outcome === outcome)
                  .map((o) => o.enrollmentId),
              },
            },
            data: { outcome },
          });
        }
        const closed = await tx.schoolYear.update({
          where: { id: year.id },
          data: { status: SchoolYearStatus.CLOSED, closedAt: new Date() },
          select: schoolYearSelect,
        });
        const next = await tx.schoolYear.create({
          data: { startYear: year.startYear + 1 },
          select: schoolYearSelect,
        });

        // Next year's classes: each class moves up a grade...
        const sources = await tx.class.findMany({
          where: { schoolYearId: year.id },
          select: {
            id: true,
            name: true,
            homeroomTeacherId: true,
            subjects: {
              select: { subjectId: true, teacherId: true, hoursPerWeek: true },
            },
          },
        });
        const created = new Map<string, string>(); // name -> id
        const open = async (
          name: string,
          source: (typeof sources)[number],
          continuation: boolean,
        ) => {
          const existing = created.get(name.toUpperCase());
          if (existing) return existing;
          const schoolClass = await tx.class.create({
            data: {
              name,
              schoolYearId: next.id,
              // The cohort keeps its homeroom teacher and teachers; a new
              // class gets the subjects, with teachers to be assigned.
              homeroomTeacherId: continuation ? source.homeroomTeacherId : null,
              previousClassId: continuation ? source.id : null,
              subjects: {
                create: source.subjects.map((s) => ({
                  subjectId: s.subjectId,
                  hoursPerWeek: s.hoursPerWeek,
                  teacherId: continuation ? s.teacherId : null,
                })),
              },
            },
            select: { id: true },
          });
          created.set(name.toUpperCase(), schoolClass.id);
          return schoolClass.id;
        };

        const byId = new Map(sources.map((s) => [s.id, s]));
        for (const source of sources) {
          const name = nextClassName(source.name);
          if (name !== null) await open(name, source, true);
        }
        // ...students who repeat join the class of their grade...
        const enrollments: { studentId: string; classId: string }[] = [];
        for (const o of outcomes) {
          const source = byId.get(o.classId)!;
          if (o.outcome === YearOutcome.PROMOTED) {
            enrollments.push({
              studentId: o.studentId,
              classId: created.get(nextClassName(source.name)!.toUpperCase())!,
            });
          } else if (o.outcome === YearOutcome.REPEATING) {
            enrollments.push({
              studentId: o.studentId,
              classId: await open(source.name, source, false),
            });
          }
        }
        // ...and new first-grade classes wait for new students.
        if (dto.createEntryClasses) {
          const levels = sources
            .map((s) => gradeLevel(s.name))
            .filter((l): l is number => l !== null);
          const entry = Math.min(...levels);
          for (const source of sources) {
            if (
              gradeLevel(source.name) === entry &&
              entry < FINAL_GRADE_LEVEL
            ) {
              await open(source.name, source, false);
            }
          }
        }
        await tx.enrollment.createMany({
          data: enrollments.map((e) => ({ ...e, schoolYearId: next.id })),
        });

        const count = (outcome: YearOutcome) =>
          outcomes.filter((o) => o.outcome === outcome).length;
        const result: OutcomeCountsDto = {
          promoted: count(YearOutcome.PROMOTED),
          repeating: count(YearOutcome.REPEATING),
          graduated: count(YearOutcome.GRADUATED),
        };
        return {
          closedYear: toSchoolYearDto(closed),
          newYear: toSchoolYearDto(next),
          outcomes: result,
          classesCreated: created.size,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30_000,
      },
    );
  }

  // ------------------------------------------------------------- helpers

  private assertInSecondSemester(year: SchoolYearRow): void {
    if (year.currentSemester !== 2) {
      throw new ConflictException(
        'End the first semester before closing the school year',
      );
    }
  }

  private async assertNeedsReexam(
    year: SchoolYearRow,
    studentId: string,
    subjectId: string,
  ): Promise<void> {
    const classes = await this.yearResults(this.prisma, year, studentId);
    const entry = classes.flatMap((c) => c.students)[0];
    if (!entry) {
      throw new NotFoundException(
        `The student is not enrolled in ${yearName(year.startYear)}`,
      );
    }
    const failed = entry.result.failedSubjects.some(
      (s) => s.subjectId === subjectId,
    );
    if (!failed) {
      throw new BadRequestException(
        'A re-exam is only for a subject with an annual average under 5',
      );
    }
  }

  /**
   * Annual results of the students of a year (or of one student), class by
   * class in natural order.
   */
  private async yearResults(
    tx: Tx | PrismaService,
    year: SchoolYearRow,
    onlyStudentId?: string,
  ) {
    const classes = await tx.class.findMany({
      where: { schoolYearId: year.id },
      select: {
        id: true,
        name: true,
        subjects: { select: { subject: { select: subjectSummarySelect } } },
        enrollments: {
          where: onlyStudentId ? { studentId: onlyStudentId } : undefined,
          select: {
            id: true,
            student: {
              select: {
                id: true,
                registrationNumber: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
    const studentIds = classes.flatMap((c) =>
      c.enrollments.map((e) => e.student.id),
    );
    const [grades, reexams] = await Promise.all([
      tx.grade.findMany({
        where: { schoolYearId: year.id, studentId: { in: studentIds } },
        select: {
          studentId: true,
          semester: true,
          value: true,
          subject: { select: subjectSummarySelect },
        },
      }),
      tx.reexam.findMany({
        where: { schoolYearId: year.id, studentId: { in: studentIds } },
        select: { studentId: true, subjectId: true, grade: true },
      }),
    ]);

    return classes
      .sort((a, b) => compareClassNames(a.name, b.name))
      .map((schoolClass) => {
        const next = nextClassName(schoolClass.name);
        return {
          class: { id: schoolClass.id, name: schoolClass.name },
          nextClassName: next,
          students: schoolClass.enrollments
            .map(({ id: enrollmentId, student }) => {
              const mine = grades.filter((g) => g.studentId === student.id);
              const subjectsById = new Map(
                [
                  ...schoolClass.subjects.map((s) => s.subject),
                  ...mine.map((g) => g.subject),
                ].map((s) => [s.id, s]),
              );
              const result = yearResult(
                [...subjectsById.keys()].map((subjectId) => ({
                  subjectId,
                  semester1: mine
                    .filter(
                      (g) => g.subject.id === subjectId && g.semester === 1,
                    )
                    .map((g) => g.value),
                  semester2: mine
                    .filter(
                      (g) => g.subject.id === subjectId && g.semester === 2,
                    )
                    .map((g) => g.value),
                  reexamGrade:
                    reexams.find(
                      (r) =>
                        r.studentId === student.id && r.subjectId === subjectId,
                    )?.grade ?? null,
                })),
                next === null,
              );
              return { enrollmentId, student, result, subjectsById };
            })
            .sort(
              (a, b) =>
                a.student.user.lastName.localeCompare(
                  b.student.user.lastName,
                ) ||
                a.student.user.firstName.localeCompare(
                  b.student.user.firstName,
                ),
            ),
        };
      });
  }
}

function fromSuggestion(suggested: SuggestedOutcome): YearOutcome | null {
  return suggested === 'REEXAM' ? null : YearOutcome[suggested];
}

export function toSchoolYearDto(year: SchoolYearRow): SchoolYearDto {
  return {
    id: year.id,
    startYear: year.startYear,
    name: yearName(year.startYear),
    status: year.status,
    currentSemester: year.currentSemester as Semester,
    semester1EndedAt: year.semester1EndedAt,
    closedAt: year.closedAt,
  };
}
