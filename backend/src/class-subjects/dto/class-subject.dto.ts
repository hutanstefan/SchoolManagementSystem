import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { OptionalNotNull } from '../../common/validators/optional-not-null';

export class CreateClassSubjectDto {
  @IsUUID()
  subjectId!: string;

  /** Teacher of this subject in this class. Omit or send null to leave it vacant. */
  @IsOptional()
  @IsUUID()
  teacherId?: string | null;

  /**
   * Lessons per week (1-10).
   * @example 4
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  hoursPerWeek!: number;

  /**
   * Most unexcused absences a student may have in this subject in a
   * semester (0-200), or null for no limit. When omitted: about a fifth of
   * the semester's lessons (4 h/week -> 14).
   * @example 14
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200)
  maxAbsences?: number | null;
}

export class UpdateClassSubjectDto {
  /** New teacher, or null to make the subject vacant. */
  @IsOptional()
  @IsUUID()
  teacherId?: string | null;

  /**
   * Lessons per week (1-10). Can't go below the lessons already in the timetable.
   * @example 3
   */
  @OptionalNotNull()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  hoursPerWeek?: number;

  /** Most unexcused absences per semester (0-200), or null for no limit. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200)
  maxAbsences?: number | null;

  /**
   * Lessons of this subject to take out of the timetable first, in the same
   * transaction (resolves an HOURS_BELOW_SCHEDULED conflict).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  removeLessonIds?: string[];
}
