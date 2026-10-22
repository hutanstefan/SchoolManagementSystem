import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { Weekday } from '../../generated/prisma/enums';
import { TimetableLessonDto } from './timetable.dto';

export const TIMETABLE_CONFLICT_TYPES = [
  'CLASS_SLOT_TAKEN',
  'TEACHER_BUSY',
  'WEEKLY_HOURS_FULL',
  'HOURS_BELOW_SCHEDULED',
] as const;
export type TimetableConflictType = (typeof TIMETABLE_CONFLICT_TYPES)[number];

/**
 * What a timetable change clashed with, in a form the client can act on
 * (offer to replace, swap, add an hour, pick a free slot...).
 */
export class TimetableConflictDto {
  /**
   * - CLASS_SLOT_TAKEN: the class already has a lesson in the slot (`lessons[0]`).
   * - TEACHER_BUSY: the teacher teaches another class then (`lessons`).
   * - WEEKLY_HOURS_FULL: all weekly hours of the subject are scheduled (`lessons`).
   * - HOURS_BELOW_SCHEDULED: fewer weekly hours than lessons in the timetable (`lessons`).
   */
  @ApiProperty({
    enum: TIMETABLE_CONFLICT_TYPES,
    enumName: 'TimetableConflictType',
  })
  type!: TimetableConflictType;

  /** The lessons involved in the conflict. */
  lessons!: TimetableLessonDto[];

  /** The slot that was asked for (slot conflicts). */
  @ApiPropertyOptional({ enum: Weekday, enumName: 'Weekday' })
  day?: Weekday;
  period?: number;

  /** The subject of the class (hours conflicts). */
  classSubjectId?: string;
  /** The subject's weekly hours (hours conflicts). */
  hoursPerWeek?: number;
}

/** A 409 response from the timetable endpoints. */
export class TimetableConflictErrorDto extends ErrorResponseDto {
  conflict!: TimetableConflictDto;
}

export class FreeSlotDto {
  @ApiProperty({ enum: Weekday, enumName: 'Weekday' })
  day!: Weekday;
  /** @example 3 */
  period!: number;
}
