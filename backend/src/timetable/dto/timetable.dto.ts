import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ClassSummaryDto,
  PersonSummaryDto,
  SubjectSummaryDto,
} from '../../common/dto/summaries.dto';
import { Trim } from '../../common/transformers';
import { Weekday } from '../../generated/prisma/enums';

export const FIRST_PERIOD = 1;
export const LAST_PERIOD = 8;

export class CreateTimetableEntryDto {
  /** The subject of the class to schedule (see the class details). */
  @IsUUID()
  classSubjectId!: string;

  @ApiProperty({ enum: Weekday, enumName: 'Weekday', example: Weekday.MONDAY })
  @IsEnum(Weekday)
  day!: Weekday;

  /**
   * Lesson number in the day (1-8).
   * @example 5
   */
  @Type(() => Number)
  @IsInt()
  @Min(FIRST_PERIOD)
  @Max(LAST_PERIOD)
  period!: number;

  /** @example Room 101 */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  room?: string | null;
}

/** Move a lesson to another slot and/or room. */
export class UpdateTimetableEntryDto {
  @ApiProperty({ enum: Weekday, enumName: 'Weekday', required: false })
  @IsOptional()
  @IsEnum(Weekday)
  day?: Weekday;

  /** @example 6 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(FIRST_PERIOD)
  @Max(LAST_PERIOD)
  period?: number;

  /** @example Physics lab */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  room?: string | null;
}

export class TimetableLessonDto {
  id!: string;

  @ApiProperty({ enum: Weekday, enumName: 'Weekday' })
  day!: Weekday;

  /** @example 2 */
  period!: number;
  /** @example Room 101 */
  room!: string | null;
  classSubjectId!: string;
  class!: ClassSummaryDto;
  subject!: SubjectSummaryDto;
  /** Null while the subject has no teacher. */
  teacher!: PersonSummaryDto | null;
}

export class TimetableDayDto {
  @ApiProperty({ enum: Weekday, enumName: 'Weekday' })
  day!: Weekday;
  /** Sorted by period. */
  lessons!: TimetableLessonDto[];
}

/** A school week: always Monday to Friday, in order. */
export class TimetableDto {
  days!: TimetableDayDto[];
}
