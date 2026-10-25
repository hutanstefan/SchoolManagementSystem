import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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
import { ToBoolean, Trim } from '../../common/transformers';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';
import { PeriodDto } from '../../school-years/dto/school-year.dto';
import type { Semester } from '../../school-years/school-year';

/** Most students one attendance can mark absent (a big class). */
export const MAX_ATTENDANCE = 100;

// ------------------------------------------------------------------- input

export class TakeAttendanceDto {
  @IsUUID()
  classId!: string;

  @IsUUID()
  subjectId!: string;

  /** The day of the lesson; today when omitted. @example 2026-10-20 */
  @IsOptional()
  @IsDateString({ strict: true })
  @IsNotFutureDate()
  date?: string;

  /**
   * Admins only: the semester it counts for, e.g. a forgotten absence of
   * an ended semester. Teachers record in the current semester.
   */
  @ApiPropertyOptional({ enum: [1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2])
  semester?: Semester;

  /** The students who were absent (the others were there). */
  @IsArray()
  @ArrayMaxSize(MAX_ATTENDANCE)
  @IsUUID('all', { each: true })
  studentIds!: string[];
}

export class AbsenceQueryDto extends PickType(PaginationQueryDto, [
  'page',
  'pageSize',
]) {
  /** The open year when omitted. */
  @IsOptional()
  @IsUUID()
  schoolYearId?: string;

  /** Both semesters when omitted. */
  @ApiPropertyOptional({ enum: [1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2])
  semester?: Semester;

  /** The students of this class (in its year). */
  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  /** true: only excused; false: only unexcused. */
  @IsOptional()
  @ToBoolean()
  @IsIn([true, false])
  excused?: boolean;
}

export class UpdateAbsenceDto {
  /** true excuses the absence, false takes the excuse back. */
  @IsBoolean()
  excused!: boolean;

  /** Why, e.g. "Medical note". Ignored when taking the excuse back. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class ExcuseAbsencesDto {
  @IsUUID()
  studentId!: string;

  /** First day (inclusive). @example 2026-10-12 */
  @IsDateString({ strict: true })
  from!: string;

  /** Last day (inclusive). @example 2026-10-16 */
  @IsDateString({ strict: true })
  to!: string;

  /** @example Medical note */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  note?: string;
}

// ------------------------------------------------------------------ output

export class AttendanceResultDto {
  /** Absences recorded now. @example 3 */
  recorded!: number;
  /** Students who already had an absence that day in this subject. @example 0 */
  alreadyAbsent!: number;
}

export class ExcuseResultDto {
  /** Absences excused now. @example 5 */
  excused!: number;
}

/** A user who recorded or excused an absence. */
export class AbsenceUserDto {
  /** The user id. */
  id!: string;
  firstName!: string;
  lastName!: string;
}

export class AbsenceDto {
  id!: string;
  /** @example 2026-10-20 */
  date!: string;
  @ApiProperty({ enum: [1, 2] })
  semester!: Semester;
  student!: PersonSummaryDto;
  subject!: SubjectSummaryDto;
  /** Who recorded it; null if that user was deleted. */
  recordedBy!: AbsenceUserDto | null;
  excused!: boolean;
  excusedAt!: Date | null;
  excusedBy!: AbsenceUserDto | null;
  /** @example Medical note */
  excuseNote!: string | null;
  /** The user can excuse or delete it: who recorded it, the homeroom teacher, an admin (open year only). */
  canChange!: boolean;
  createdAt!: Date;
}

export class PaginatedAbsencesDto {
  /** Newest first. */
  data!: AbsenceDto[];
  meta!: PaginationMetaDto;
}

/** Absences of one student in one subject, in a semester. */
export class AbsenceCountDto {
  /** Count against the limit. @example 3 */
  unexcused!: number;
  /** @example 2 */
  excused!: number;
}

export class SubjectAbsencesDto extends AbsenceCountDto {
  subject!: SubjectSummaryDto;
  /** Null: no limit. @example 14 */
  maxAbsences!: number | null;
}

export class ClassAbsenceRowDto {
  student!: PersonSummaryDto;
  /** @example 2026-0042 */
  registrationNumber!: string;
  /** All subjects together. */
  total!: AbsenceCountDto;
  /** Every subject of the class, the ones with absences or a limit. */
  subjects!: SubjectAbsencesDto[];
  /** Subjects where the unexcused absences are over the limit. */
  overLimit!: number;
  /** Subjects where they are close to it (80% or more), not over. */
  nearLimit!: number;
}

export class ClassAbsencesDto {
  class!: ClassSummaryDto;
  period!: PeriodDto;
  /** True when nothing can be changed: a closed year. */
  readOnly!: boolean;
  students!: ClassAbsenceRowDto[];
}
