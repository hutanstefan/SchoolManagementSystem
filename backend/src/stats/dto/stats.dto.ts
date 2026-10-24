import { PeriodDto } from '../../school-years/dto/school-year.dto';
import {
  ClassSummaryDto,
  SubjectSummaryDto,
} from '../../common/dto/summaries.dto';

export class GradeCountDto {
  /** @example 8 */
  value!: number;
  /** How many grades of this value. @example 214 */
  count!: number;
}

export class WeekActivityDto {
  /** Monday of the week (YYYY-MM-DD). @example 2026-10-19 */
  weekStart!: string;
  /** Grades given that week. @example 37 */
  count!: number;
}

export class ClassStatsDto {
  class!: ClassSummaryDto;
  /** Mean of the students' subject averages (two decimals), or null. @example 7.84 */
  average!: number | null;
  /** @example 10 */
  studentCount!: number;
  /** Students with at least one subject average under 5. @example 1 */
  studentsAtRisk!: number;
}

export class SubjectStatsDto {
  subject!: SubjectSummaryDto;
  /** Mean of the students' averages in this subject. @example 7.9 */
  average!: number | null;
  /** @example 182 */
  gradeCount!: number;
}

/** The whole school at a glance (admin dashboard). */
export class SchoolStatsDto {
  /** The school year and semester of the figures. */
  period!: PeriodDto;
  /** Mean of every student's subject averages. @example 7.86 */
  average!: number | null;
  /** @example 1456 */
  gradeCount!: number;
  /** Students with at least one subject average under 5. @example 3 */
  studentsAtRisk!: number;
  /** Grades 1 to 10, each with how many were given. */
  gradeDistribution!: GradeCountDto[];
  /** Natural class order (9A before 10A). */
  classes!: ClassStatsDto[];
  subjects!: SubjectStatsDto[];
  /**
   * Grades given per week, oldest first: the last 8 weeks of the current
   * semester, or the whole of an ended one.
   */
  activity!: WeekActivityDto[];
}

export class TeachingStatsRowDto {
  class!: ClassSummaryDto;
  subject!: SubjectSummaryDto;
  /** Mean of the students' averages in the subject. @example 7.42 */
  average!: number | null;
  /** @example 10 */
  studentCount!: number;
  /** Students whose average in the subject is under 5. @example 1 */
  studentsAtRisk!: number;
  /** Students with fewer grades than the minimum (weekly hours + 1). @example 6 */
  studentsMissingGrades!: number;
}

/** A teacher's classes and subjects at a glance (teacher dashboard). */
export class TeachingStatsDto {
  period!: PeriodDto;
  /** One row per subject the teacher teaches in a class. */
  rows!: TeachingStatsRowDto[];
  /** Grades in the teacher's subjects and classes, 1 to 10. */
  gradeDistribution!: GradeCountDto[];
  /** Grades given in the teacher's subjects per week (see SchoolStatsDto.activity). */
  activity!: WeekActivityDto[];
}
