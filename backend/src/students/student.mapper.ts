import { Prisma } from '../generated/prisma/client';
import { StudentDto } from './dto/student.dto';

/** Fields needed to build a StudentDto. Shared with the classes module. */
export const studentSelect = {
  id: true,
  dateOfBirth: true,
  class: { select: { id: true, name: true } },
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
  },
} as const satisfies Prisma.StudentSelect;

export type StudentRow = Prisma.StudentGetPayload<{
  select: typeof studentSelect;
}>;

export function toStudentDto(student: StudentRow): StudentDto {
  return {
    id: student.id,
    userId: student.user.id,
    email: student.user.email,
    firstName: student.user.firstName,
    lastName: student.user.lastName,
    dateOfBirth: student.dateOfBirth.toISOString().slice(0, 10),
    class: student.class,
    createdAt: student.user.createdAt,
  };
}
