import { ApiProperty } from '@nestjs/swagger';
import { SubjectColor } from '../../generated/prisma/enums';
/** Small embedded objects reused across responses. */

export class ClassSummaryDto {
  id!: string;
  /** @example 9A */
  name!: string;
}

export class SubjectSummaryDto {
  id!: string;
  /** @example Mathematics */
  name!: string;
  /** Its colour in the app, chosen by the admin. */
  @ApiProperty({ enum: SubjectColor, enumName: 'SubjectColor' })
  color!: SubjectColor;
}

export class PersonSummaryDto {
  /** Teacher or student id (not the user id). */
  id!: string;
  /** @example Mihai */
  firstName!: string;
  /** @example Ionescu */
  lastName!: string;
}
