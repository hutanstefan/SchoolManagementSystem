import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { YearOutcome } from '../../generated/prisma/enums';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { ClassSummaryDto } from '../../common/dto/summaries.dto';
import { ToBoolean } from '../../common/transformers';
import { IsPastDate } from '../../common/validators/is-past-date.validator';
import { CreateAccountDto } from '../../users/dto/create-account.dto';

export class CreateStudentDto extends CreateAccountDto {
  /**
   * Format YYYY-MM-DD.
   * @example 2011-03-14
   */
  @IsDateString({ strict: true })
  @IsPastDate()
  dateOfBirth!: string;

  /**
   * Class to enroll the student in, in the open school year. Omit or send
   * null to leave unassigned.
   */
  @IsOptional()
  @IsUUID()
  classId?: string | null;
}

/** Every field is optional. `password` resets it, `classId: null` unassigns the student. */
export class UpdateStudentDto extends PartialType(CreateStudentDto, {
  // A field that is sent must be valid: null is not \"leave as is\".
  skipNullProperties: false,
}) {}

export const STUDENT_SORT_FIELDS = [
  'lastName',
  'firstName',
  'email',
  'dateOfBirth',
  'registrationNumber',
  'createdAt',
] as const;

export class StudentQueryDto extends PaginationQueryDto {
  /** Field to sort by. */
  @ApiPropertyOptional({ enum: STUDENT_SORT_FIELDS, default: 'lastName' })
  @IsOptional()
  @IsIn(STUDENT_SORT_FIELDS)
  sort: (typeof STUDENT_SORT_FIELDS)[number] = 'lastName';

  /** The school year whose classes are shown; the open one when omitted. */
  @IsOptional()
  @IsUUID()
  schoolYearId?: string;

  /** Only students of this class. */
  @IsOptional()
  @IsUUID()
  classId?: string;

  /** Only students without a class that year (graduates excluded). */
  @IsOptional()
  @ToBoolean()
  @IsIn([true, false])
  unassigned?: boolean;

  /**
   * true: only the students who graduated before that year (they left the
   * school); false: everyone else.
   */
  @IsOptional()
  @ToBoolean()
  @IsIn([true, false])
  graduated?: boolean;
}

export class StudentDto {
  id!: string;
  userId!: string;
  /**
   * Number in the school register (număr matricol): year of enrollment and
   * number in that year, given automatically. @example 2026-0042
   */
  registrationNumber!: string;
  /** @example student@school.test */
  email!: string;
  /** @example Andrei */
  firstName!: string;
  /** @example Georgescu */
  lastName!: string;
  /** @example 2011-07-25 */
  dateOfBirth!: string;
  /** The class in the school year asked for; null when not enrolled. */
  class!: ClassSummaryDto | null;
  /** The school year the student graduated in, if they did. @example 2025–2026 */
  graduatedIn!: string | null;
  createdAt!: Date;
}

export class SchoolYearRefDto {
  id!: string;
  /** @example 2025–2026 */
  name!: string;
}

export class StudentYearDto {
  /** @example 2025–2026 */
  schoolYear!: SchoolYearRefDto;
  class!: ClassSummaryDto;
  /** How the year ended; null while it is open. */
  @ApiProperty({ enum: YearOutcome, enumName: 'YearOutcome', nullable: true })
  outcome!: YearOutcome | null;
}

export class StudentDetailDto extends StudentDto {
  /** The student's classes, year by year, newest first. */
  history!: StudentYearDto[];
}

export class PaginatedStudentsDto {
  data!: StudentDto[];
  meta!: PaginationMetaDto;
}
