import { ApiProperty } from '@nestjs/swagger';
import { ClassSummaryDto } from '../../common/dto/summaries.dto';
import { Role } from '../../generated/prisma/enums';

export class StudentProfileDto {
  id!: string;
  /** Number in the school register (nr. matricol). @example 2026-0042 */
  registrationNumber!: string;
  /** @example 2011-05-14 */
  dateOfBirth!: string;
  /** Null when the student is not assigned to a class yet. */
  class!: ClassSummaryDto | null;
}

export class TeacherProfileDto {
  id!: string;
}

/** The logged-in user, with the profile that matches their role. */
export class AuthUserDto {
  id!: string;
  /** @example student@school.test */
  email!: string;
  /** @example Andrei */
  firstName!: string;
  /** @example Georgescu */
  lastName!: string;

  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.STUDENT })
  role!: Role;

  /** Present only for students. */
  student!: StudentProfileDto | null;
  /** Present only for teachers. */
  teacher!: TeacherProfileDto | null;
}
