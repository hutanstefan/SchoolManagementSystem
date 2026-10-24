import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { compareClassNames } from '../classes/class-names';
import { todayInSchool } from '../common/dates';
import { subjectSummarySelect } from '../common/mappers';
import { minimumGrades } from '../grades/averages';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodQueryDto } from '../school-years/dto/school-year.dto';
import {
  SchoolYearsService,
  toSchoolYearDto,
  type Period,
} from '../school-years/school-years.service';
import { SchoolStatsDto, TeachingStatsDto } from './dto/stats.dto';
import {
  averagesByStudent,
  distribution,
  mean,
  PASSING_GRADE,
  weeklyActivity,
} from './stats-math';

/**
 * Today in the school's calendar (grades are dated that way), so a week
 * starts on Monday at midnight in Romania, not in UTC.
 */
function schoolToday(): Date {
  return new Date(`${todayInSchool()}T00:00:00Z`);
}

/** Weeks shown for an ended semester: all of it (about 20). */
const MAX_WEEKS = 26;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The weeks to show: the last 8 up to today in the current semester; for an
 * ended one, from its first grade to its last.
 */
function activityRange(
  period: Period,
  grades: { date: Date }[],
): { end: Date; weeks: number } {
  const current =
    period.year.status === 'ACTIVE' &&
    period.semester === period.year.currentSemester;
  if (current || grades.length === 0) return { end: schoolToday(), weeks: 8 };
  const times = grades.map((g) => g.date.getTime());
  const first = Math.min(...times);
  const last = Math.max(...times);
  const weeks = Math.ceil((last - first) / WEEK_MS) + 1;
  return {
    end: new Date(last),
    weeks: Math.min(Math.max(weeks, 1), MAX_WEEKS),
  };
}

/**
 * Figures for the dashboards, computed from the grades with the same rules
 * as the report cards (averages are never stored). A school has a few
 * thousand grades, so they are read once and aggregated in memory.
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly years: SchoolYearsService,
  ) {}

  /** The school in a semester (the current one by default). */
  async school(query: PeriodQueryDto = {}): Promise<SchoolStatsDto> {
    const period = await this.years.resolvePeriod(query);
    const { year, semester } = period;
    const [grades, classes, subjects, enrollments] = await Promise.all([
      this.prisma.grade.findMany({
        where: { schoolYearId: year.id, semester },
        select: { studentId: true, subjectId: true, value: true, date: true },
      }),
      this.prisma.class.findMany({
        where: { schoolYearId: year.id },
        select: { id: true, name: true },
      }),
      this.prisma.subject.findMany({
        select: subjectSummarySelect,
        orderBy: { name: 'asc' },
      }),
      this.prisma.enrollment.findMany({
        where: { schoolYearId: year.id },
        select: { studentId: true, classId: true },
      }),
    ]);
    const students = enrollments.map((e) => ({
      id: e.studentId,
      classId: e.classId,
    }));

    const averages = averagesByStudent(grades);
    const atRisk = (studentId: string) =>
      [...(averages.get(studentId)?.values() ?? [])].some(
        (a) => a.roundedAverage !== null && a.roundedAverage < PASSING_GRADE,
      );
    const allAverages = (studentIds: string[]) =>
      studentIds.flatMap((id) =>
        [...(averages.get(id)?.values() ?? [])].map((a) => a.average!),
      );

    const range = activityRange(period, grades);
    return {
      period: { schoolYear: toSchoolYearDto(year), semester },
      average: mean(allAverages(students.map((s) => s.id))),
      gradeCount: grades.length,
      studentsAtRisk: students.filter((s) => atRisk(s.id)).length,
      gradeDistribution: distribution(grades),
      classes: classes
        .sort((a, b) => compareClassNames(a.name, b.name))
        .map((schoolClass) => {
          const ids = students
            .filter((s) => s.classId === schoolClass.id)
            .map((s) => s.id);
          return {
            class: schoolClass,
            average: mean(allAverages(ids)),
            studentCount: ids.length,
            studentsAtRisk: ids.filter(atRisk).length,
          };
        }),
      // Subjects taught or graded that semester.
      subjects: subjects
        .filter((subject) => grades.some((g) => g.subjectId === subject.id))
        .map((subject) => ({
          subject,
          average: mean(
            [...averages.values()]
              .map((bySubject) => bySubject.get(subject.id)?.average)
              .filter((a): a is number => a !== undefined && a !== null),
          ),
          gradeCount: grades.filter((g) => g.subjectId === subject.id).length,
        })),
      activity: weeklyActivity(grades, range.end, range.weeks),
    };
  }

  /** The subjects a teacher teaches, class by class. */
  async teaching(
    user: AuthUser,
    query: PeriodQueryDto = {},
  ): Promise<TeachingStatsDto> {
    const period = await this.years.resolvePeriod(query);
    const { year, semester } = period;
    const assignments = await this.prisma.classSubject.findMany({
      where: { teacher: { userId: user.id }, class: { schoolYearId: year.id } },
      select: {
        hoursPerWeek: true,
        class: {
          select: {
            id: true,
            name: true,
            enrollments: { select: { studentId: true } },
          },
        },
        subject: { select: subjectSummarySelect },
      },
    });
    const studentIds = assignments.flatMap((a) =>
      a.class.enrollments.map((s) => s.studentId),
    );
    const grades = await this.prisma.grade.findMany({
      where: {
        schoolYearId: year.id,
        semester,
        studentId: { in: studentIds },
        subjectId: { in: assignments.map((a) => a.subject.id) },
      },
      select: { studentId: true, subjectId: true, value: true, date: true },
    });
    // Only the grades of a subject in the class the teacher teaches it in.
    const taught = new Set(
      assignments.flatMap((a) =>
        a.class.enrollments.map((s) => `${s.studentId}:${a.subject.id}`),
      ),
    );
    const mine = grades.filter((g) =>
      taught.has(`${g.studentId}:${g.subjectId}`),
    );
    const averages = averagesByStudent(mine);

    const rows = assignments
      .map((a) => {
        const students = a.class.enrollments.map((s) => s.studentId);
        const subjectAverages = students
          .map((id) => averages.get(id)?.get(a.subject.id))
          .filter((x) => x !== undefined);
        const minimum = minimumGrades(a.hoursPerWeek);
        const counts = (id: string) =>
          mine.filter((g) => g.studentId === id && g.subjectId === a.subject.id)
            .length;
        return {
          class: { id: a.class.id, name: a.class.name },
          subject: a.subject,
          average: mean(subjectAverages.map((x) => x.average!)),
          studentCount: students.length,
          studentsAtRisk: subjectAverages.filter(
            (x) => x.roundedAverage! < PASSING_GRADE,
          ).length,
          studentsMissingGrades: students.filter((id) => counts(id) < minimum)
            .length,
        };
      })
      .sort(
        (a, b) =>
          compareClassNames(a.class.name, b.class.name) ||
          a.subject.name.localeCompare(b.subject.name),
      );

    const range = activityRange(period, mine);
    return {
      period: { schoolYear: toSchoolYearDto(year), semester },
      rows,
      gradeDistribution: distribution(mine),
      activity: weeklyActivity(mine, range.end, range.weeks),
    };
  }
}
