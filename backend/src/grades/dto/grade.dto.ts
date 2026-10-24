import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import {
  ClassSummaryDto,
  PersonSummaryDto,
  SubjectSummaryDto,
} from '../../common/dto/summaries.dto';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';
import { GradeAction, Role, YearOutcome } from '../../generated/prisma/enums';
import {
  PeriodDto,
  SchoolYearDto,
} from '../../school-years/dto/school-year.dto';
import type { Semester } from '../../school-years/school-year';
import { OptionalNotNull } from '../../common/validators/optional-not-null';

export class CreateGradeDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  subjectId!: string;

  /**
   * Grade from 1 to 10.
   * @example 9
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  value!: number;

  /**
   * YYYY-MM-DD, today or earlier. Defaults to today.
   * @example 2026-10-20
   */
  @IsOptional()
  @IsDateString({ strict: true })
  @IsNotFutureDate()
  date?: string;

  /**
   * 1 or 2. Defaults to the current semester. Only admins can add grades
   * to a semester that has ended.
   */
  @ApiPropertyOptional({ enum: [1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2])
  semester?: Semester;
}

export class BatchGradeDto {
  @IsUUID()
  studentId!: string;

  /** @example 9 */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  value!: number;

  /**
   * Date of this grade (YYYY-MM-DD, today or earlier), e.g. from a
   * spreadsheet. Defaults to the date of the batch.
   */
  @IsOptional()
  @IsDateString({ strict: true })
  @IsNotFutureDate()
  date?: string;

  /**
   * Replace this existing grade of the student in the subject (value and
   * date change, the history keeps the old ones) instead of adding a new one.
   * Teachers can only replace grades they gave.
   */
  @IsOptional()
  @IsUUID()
  replaceGradeId?: string;
}

/** Up to this many grades are saved in one batch. */
export const MAX_BATCH_GRADES = 500;

export class CreateGradesBatchDto {
  /** The subject every grade in the batch is for. */
  @IsUUID()
  subjectId!: string;

  /**
   * Date of every grade in the batch: YYYY-MM-DD, today or earlier. Defaults to today.
   * @example 2026-10-20
   */
  @IsOptional()
  @IsDateString({ strict: true })
  @IsNotFutureDate()
  date?: string;

  /**
   * 1 or 2. Defaults to the current semester. Only admins can add grades
   * to a semester that has ended.
   */
  @ApiPropertyOptional({ enum: [1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2])
  semester?: Semester;

  /** One grade per student; a student can appear only once. */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BATCH_GRADES)
  @ValidateNested({ each: true })
  @Type(() => BatchGradeDto)
  grades!: BatchGradeDto[];
}

export class GradesBatchResultDto {
  /** Number of grades saved (created or replaced). @example 24 */
  count!: number;
  /** How many of them replaced an existing grade. @example 1 */
  replaced!: number;
  /** Ids of the saved grades, in the order they were sent. */
  gradeIds!: string[];
}

export class UpdateGradeDto {
  /** @example 10 */
  @OptionalNotNull()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  value?: number;

  /** @example 2026-10-19 */
  @OptionalNotNull()
  @IsDateString({ strict: true })
  @IsNotFutureDate()
  date?: string;
}

export const GRADE_SORT_FIELDS = ['date', 'value', 'createdAt'] as const;

export class GradeQueryDto extends PaginationQueryDto {
  /** The school year; the open one when omitted. */
  @IsOptional()
  @IsUUID()
  schoolYearId?: string;

  /** 1 or 2; the year's current semester when omitted. */
  @ApiPropertyOptional({ enum: [1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2])
  semester?: Semester;

  /** Field to sort by (newest first by default). */
  @ApiPropertyOptional({ enum: GRADE_SORT_FIELDS, default: 'date' })
  @IsOptional()
  @IsIn(GRADE_SORT_FIELDS)
  sort: (typeof GRADE_SORT_FIELDS)[number] = 'date';

  /** Sort direction (newest first by default). */
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  override order: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class GradebookQueryDto {
  @IsUUID()
  subjectId!: string;

  /** 1 or 2; the class's current semester when omitted. */
  @ApiPropertyOptional({ enum: [1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2])
  semester?: Semester;
}

export class GradeDto {
  id!: string;
  /** @example 9 */
  value!: number;
  /** @example 2026-10-20 */
  date!: string;
  student!: PersonSummaryDto;
  /** The student's class in the grade's school year. */
  class!: ClassSummaryDto | null;
  subject!: SubjectSummaryDto;
  schoolYearId!: string;
  /** @example 1 */
  @ApiProperty({ enum: [1, 2] })
  semester!: Semester;
  /** Who gave the grade. Null if that teacher was deleted. */
  teacher!: PersonSummaryDto | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PaginatedGradesDto {
  data!: GradeDto[];
  meta!: PaginationMetaDto;
}

/** A grade inside a report or gradebook. */
export class GradeEntryDto {
  id!: string;
  /** @example 9 */
  value!: number;
  /** @example 2026-10-20 */
  date!: string;
  teacher!: PersonSummaryDto | null;
}

export class SubjectGradesDto {
  subject!: SubjectSummaryDto;
  /** Current teacher of the subject in the student's class. */
  teacher!: PersonSummaryDto | null;
  /** Sorted by date. */
  grades!: GradeEntryDto[];
  /**
   * Mean with two decimals, truncated.
   * @example 9.5
   */
  average!: number | null;
  /**
   * Average rounded to a whole grade (.50 rounds up).
   * @example 10
   */
  roundedAverage!: number | null;
  /**
   * Weekly hours + 1. Null if the subject isn't taught in the student's current class.
   * @example 5
   */
  minimumGrades!: number | null;
  /** Whether the student has at least the minimum number of grades. */
  hasMinimumGrades!: boolean | null;
}

export class StudentGradesReportDto {
  student!: PersonSummaryDto;
  /** Number in the school register (nr. matricol). @example 2026-0042 */
  registrationNumber!: string;
  /** The year and semester of the report. */
  period!: PeriodDto;
  /** The student's class that year. */
  class!: ClassSummaryDto | null;
  /** Every subject of the class (and any other subject the student has grades in). */
  subjects!: SubjectGradesDto[];
  /**
   * Mean of the rounded subject averages, two decimals, truncated.
   * Null until every subject has at least one grade.
   * @example 9.12
   */
  overallAverage!: number | null;
}

export class GradebookRowDto {
  student!: PersonSummaryDto;
  /** The student's number in the school register (nr. matricol). @example 2026-0042 */
  registrationNumber!: string;
  grades!: GradeEntryDto[];
  /** @example 8.66 */
  average!: number | null;
  /** @example 9 */
  roundedAverage!: number | null;
  hasMinimumGrades!: boolean;
}

/** One subject of one class: every student with their grades and average. */
export class GradebookDto {
  class!: ClassSummaryDto;
  period!: PeriodDto;
  /**
   * True when the user can't add or change grades here: a closed year, or
   * (for a teacher) a semester that has ended.
   */
  readOnly!: boolean;
  subject!: SubjectSummaryDto;
  teacher!: PersonSummaryDto | null;
  /** @example 4 */
  hoursPerWeek!: number;
  /** @example 5 */
  minimumGrades!: number;
  students!: GradebookRowDto[];
}

export class GradeChangedByDto {
  /** User id. */
  id!: string;
  /** @example Mihai */
  firstName!: string;
  /** @example Ionescu */
  lastName!: string;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role!: Role;
}

export class GradeHistoryEntryDto {
  id!: string;
  gradeId!: string;

  @ApiProperty({ enum: GradeAction, enumName: 'GradeAction' })
  action!: GradeAction;

  oldValue!: number | null;
  newValue!: number | null;
  oldDate!: string | null;
  newDate!: string | null;
  /** Null if that account was deleted. */
  changedBy!: GradeChangedByDto | null;
  changedAt!: Date;
}

export class SubjectYearDto {
  subject!: SubjectSummaryDto;
  /** Rounded average of each semester. @example 7 */
  semester1!: number | null;
  /** @example 8 */
  semester2!: number | null;
  /** Mean of the two semester averages. @example 7.5 */
  annual!: number | null;
  /** Grade of the re-exam (corigență), if the student took one. */
  reexamGrade!: number | null;
  /** The re-exam grade, else the annual average. */
  final!: number | null;
  /** Final average of at least 5. */
  passed!: boolean;
}

/** A student's whole school year: both semesters and the annual averages. */
export class StudentYearReportDto {
  student!: PersonSummaryDto;
  /** @example 2026-0042 */
  registrationNumber!: string;
  schoolYear!: SchoolYearDto;
  class!: ClassSummaryDto | null;
  subjects!: SubjectYearDto[];
  /** Mean of the final subject averages; null while one is missing. @example 8.42 */
  generalAverage!: number | null;
  /** How the year ended (closed years). */
  @ApiProperty({ enum: YearOutcome, enumName: 'YearOutcome', nullable: true })
  outcome!: YearOutcome | null;
}
