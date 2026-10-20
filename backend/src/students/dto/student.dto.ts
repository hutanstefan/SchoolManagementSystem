import { PartialType } from '@nestjs/swagger';
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

  /** Class to enroll the student in. Omit or send null to leave unassigned. */
  @IsOptional()
  @IsUUID()
  classId?: string | null;
}

/** Every field is optional. `password` resets it, `classId: null` unassigns the student. */
export class UpdateStudentDto extends PartialType(CreateStudentDto) {}

export const STUDENT_SORT_FIELDS = [
  'lastName',
  'firstName',
  'email',
  'dateOfBirth',
  'createdAt',
] as const;

export class StudentQueryDto extends PaginationQueryDto {
  /** Field to sort by. */
  @IsOptional()
  @IsIn(STUDENT_SORT_FIELDS)
  sort: (typeof STUDENT_SORT_FIELDS)[number] = 'lastName';

  /** Only students of this class. */
  @IsOptional()
  @IsUUID()
  classId?: string;

  /** Only students without a class. */
  @IsOptional()
  @ToBoolean()
  @IsIn([true, false])
  unassigned?: boolean;
}

export class StudentDto {
  id!: string;
  userId!: string;
  /** @example student@school.test */
  email!: string;
  /** @example Andrei */
  firstName!: string;
  /** @example Georgescu */
  lastName!: string;
  /** @example 2011-07-25 */
  dateOfBirth!: string;
  /** Null when the student is not assigned to a class. */
  class!: ClassSummaryDto | null;
  createdAt!: Date;
}

export class PaginatedStudentsDto {
  data!: StudentDto[];
  meta!: PaginationMetaDto;
}
