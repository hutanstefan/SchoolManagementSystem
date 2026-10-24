import { Prisma, YearOutcome } from '../generated/prisma/client';
import { yearName } from '../school-years/school-year';
import { StudentDto } from './dto/student.dto';

/**
 * Fields needed to build a StudentDto, with the student's class in one
 * school year. Shared with the classes module.
 */
export function studentSelect(schoolYearId: string) {
  return {
    id: true,
    registrationNumber: true,
    dateOfBirth: true,
    enrollments: {
      where: {
        OR: [{ schoolYearId }, { outcome: YearOutcome.GRADUATED }],
      },
      select: {
        schoolYearId: true,
        outcome: true,
        class: { select: { id: true, name: true } },
        schoolYear: { select: { startYear: true } },
      },
    },
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
}

export type StudentRow = Prisma.StudentGetPayload<{
  select: ReturnType<typeof studentSelect>;
}>;

export function toStudentDto(
  student: StudentRow,
  schoolYearId: string,
): StudentDto {
  const enrollment = student.enrollments.find(
    (e) => e.schoolYearId === schoolYearId,
  );
  const graduation = student.enrollments.find(
    (e) => e.outcome === YearOutcome.GRADUATED,
  );
  return {
    id: student.id,
    userId: student.user.id,
    registrationNumber: student.registrationNumber,
    email: student.user.email,
    firstName: student.user.firstName,
    lastName: student.user.lastName,
    dateOfBirth: student.dateOfBirth.toISOString().slice(0, 10),
    class: enrollment?.class ?? null,
    graduatedIn: graduation ? yearName(graduation.schoolYear.startYear) : null,
    createdAt: student.user.createdAt,
  };
}
