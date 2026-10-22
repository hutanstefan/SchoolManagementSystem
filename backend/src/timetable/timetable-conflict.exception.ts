import { ConflictException } from '@nestjs/common';
import type { TimetableConflictDto } from './dto/timetable-conflict.dto';

/** A 409 that also says what the change clashed with (see TimetableConflictDto). */
export class TimetableConflictException extends ConflictException {
  constructor(
    message: string,
    readonly conflict: TimetableConflictDto,
  ) {
    super({ message, conflict });
  }
}
