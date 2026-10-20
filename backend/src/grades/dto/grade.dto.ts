import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
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
import { GradeAction, Role } from '../../generated/prisma/enums';

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
}

export class UpdateGradeDto {
  /** @example 10 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  value?: number;

  /** @example 2026-10-19 */
  @IsOptional()
  @IsDateString({ strict: true })
  @IsNotFutureDate()
  date?: string;
}

export const GRADE_SORT_FIELDS = ['date', 'value', 'createdAt'] as const;

export class GradeQueryDto extends PaginationQueryDto {
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

export class GradeDto {
  id!: string;
  /** @example 9 */
  value!: number;
  /** @example 2026-10-20 */
  date!: string;
  student!: PersonSummaryDto;
  /** The student's current class. */
  class!: ClassSummaryDto | null;
  subject!: SubjectSummaryDto;
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
