import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ClassSummaryDto,
  SubjectSummaryDto,
} from '../../common/dto/summaries.dto';
import { SchoolYearStatus, YearOutcome } from '../../generated/prisma/enums';
import type { Semester } from '../school-year';

// ------------------------------------------------------------------ queries

/** Which school year to show; the current one when omitted. */
export class YearQueryDto {
  @IsOptional()
  @IsUUID()
  schoolYearId?: string;
}

/** Which school year and semester to show; the current ones when omitted. */
export class PeriodQueryDto extends YearQueryDto {
  /** 1 or 2. Defaults to the year's current semester (2 for a closed year). */
  @ApiPropertyOptional({ enum: [1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2])
  semester?: Semester;
}

// ---------------------------------------------------------------- responses

export class SchoolYearDto {
  id!: string;
  /** @example 2026 */
  startYear!: number;
  /** @example 2026–2027 */
  name!: string;
  @ApiProperty({ enum: SchoolYearStatus, enumName: 'SchoolYearStatus' })
  status!: SchoolYearStatus;
  /** 1 or 2: new grades go to this semester. @example 1 */
  @ApiProperty({ enum: [1, 2] })
  currentSemester!: Semester;
  semester1EndedAt!: Date | null;
  closedAt!: Date | null;
}

/** The year and semester a response is about. */
export class PeriodDto {
  schoolYear!: SchoolYearDto;
  @ApiProperty({ enum: [1, 2] })
  semester!: Semester;
}

export class OutcomeCountsDto {
  /** @example 47 */
  promoted!: number;
  /** @example 2 */
  repeating!: number;
  /** @example 10 */
  graduated!: number;
}

export class SchoolYearSummaryDto extends SchoolYearDto {
  /** @example 6 */
  classCount!: number;
  /** Students enrolled in a class that year. @example 60 */
  studentCount!: number;
  /** For a closed year: how it ended for its students. */
  outcomes!: OutcomeCountsDto | null;
}

// ------------------------------------------------------- closing the year

/** What the rules suggest for a student; REEXAM: re-exam results needed. */
export const SUGGESTED_OUTCOMES = [
  'PROMOTED',
  'GRADUATED',
  'REPEATING',
  'REEXAM',
] as const;

export class SubjectYearResultDto {
  subject!: SubjectSummaryDto;
  /** Rounded semester averages. @example 7 */
  semester1!: number | null;
  /** @example 8 */
  semester2!: number | null;
  /** Mean of the semester averages. @example 7.5 */
  annual!: number | null;
  /** Grade of the re-exam, when there was one. */
  reexamGrade!: number | null;
  /** The re-exam grade if any, else the annual average. */
  final!: number | null;
  passed!: boolean;
}

export class ClosingStudentDto {
  id!: string;
  /** @example Andrei */
  firstName!: string;
  /** @example Georgescu */
  lastName!: string;
  /** @example 2026-0001 */
  registrationNumber!: string;
  /** Annual general average; null while a subject has none. @example 8.42 */
  generalAverage!: number | null;
  /** Subjects with an annual average under 5 (or none), with re-exams. */
  failedSubjects!: SubjectYearResultDto[];
  @ApiProperty({ enum: SUGGESTED_OUTCOMES })
  suggestedOutcome!: (typeof SUGGESTED_OUTCOMES)[number];
}

export class ClosingClassDto {
  class!: ClassSummaryDto;
  /** Where its students go next year; null for the final grade (they graduate). */
  nextClassName!: string | null;
  students!: ClosingStudentDto[];
}

export class ClosingPreviewDto {
  schoolYear!: SchoolYearDto;
  /** The year that will be opened: @example 2027–2028 */
  nextYearName!: string;
  classes!: ClosingClassDto[];
}

export class SaveReexamDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  subjectId!: string;

  /** @example 6 */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  grade!: number;
}

export class OutcomeDecisionDto {
  @IsUUID()
  studentId!: string;

  @ApiProperty({ enum: YearOutcome, enumName: 'YearOutcome' })
  @IsIn(Object.values(YearOutcome))
  outcome!: YearOutcome;
}

export class CloseYearDto {
  /**
   * The admin's decision for some students, overriding the suggestion. Every
   * student still waiting for re-exam results needs one.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => OutcomeDecisionDto)
  decisions: OutcomeDecisionDto[] = [];

  /**
   * Also open empty classes for the new first-grade students (a new 9A for
   * this year's 9A, with the same subjects, teachers to be assigned).
   */
  @IsOptional()
  @IsBoolean()
  createEntryClasses: boolean = true;
}

export class CloseYearResultDto {
  closedYear!: SchoolYearDto;
  newYear!: SchoolYearDto;
  outcomes!: OutcomeCountsDto;
  /** Classes opened in the new year. @example 6 */
  classesCreated!: number;
}
