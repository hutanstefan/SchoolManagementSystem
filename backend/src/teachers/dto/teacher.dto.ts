import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import {
  ClassSummaryDto,
  SubjectSummaryDto,
} from '../../common/dto/summaries.dto';
import { CreateAccountDto } from '../../users/dto/create-account.dto';

export class CreateTeacherDto extends CreateAccountDto {}

/** Every field is optional; sending `password` resets it. */
export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}

export const TEACHER_SORT_FIELDS = [
  'lastName',
  'firstName',
  'email',
  'createdAt',
] as const;

export class TeacherQueryDto extends PaginationQueryDto {
  /** Field to sort by. */
  @ApiPropertyOptional({ enum: TEACHER_SORT_FIELDS, default: 'lastName' })
  @IsOptional()
  @IsIn(TEACHER_SORT_FIELDS)
  sort: (typeof TEACHER_SORT_FIELDS)[number] = 'lastName';
}

export class TeacherDto {
  id!: string;
  userId!: string;
  /** @example teacher@school.test */
  email!: string;
  /** @example Mihai */
  firstName!: string;
  /** @example Ionescu */
  lastName!: string;
  createdAt!: Date;
}

export class TeachingAssignmentDto {
  classSubjectId!: string;
  class!: ClassSummaryDto;
  subject!: SubjectSummaryDto;
  /** @example 4 */
  hoursPerWeek!: number;
}

export class TeacherDetailDto extends TeacherDto {
  /** Classes where this teacher is the homeroom teacher (diriginte). */
  homeroomClasses!: ClassSummaryDto[];
  /** Subjects taught, per class. */
  teaching!: TeachingAssignmentDto[];
}

export class PaginatedTeachersDto {
  data!: TeacherDto[];
  meta!: PaginationMetaDto;
}
