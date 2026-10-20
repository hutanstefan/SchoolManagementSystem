import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

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
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  hoursPerWeek?: number;
}
