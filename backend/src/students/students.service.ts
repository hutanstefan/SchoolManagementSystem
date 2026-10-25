import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Paginated, pageArgs, paginated } from '../common/dto/pagination.dto';
import { todayInSchool } from '../common/dates';
import { hashPassword } from '../common/password';
import { Prisma, Role, YearOutcome } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { yearName } from '../school-years/school-year';
import { SchoolYearsService } from '../school-years/school-years.service';
import { UsersService } from '../users/users.service';
import {
  CreateStudentDto,
  StudentDetailDto,
  StudentDto,
  StudentQueryDto,
  UpdateStudentDto,
} from './dto/student.dto';
import {
  formatRegistrationNumber,
  nextNumberInYear,
  parseRegistrationNumber,
} from './registration-number';
import { studentSelect, toStudentDto } from './student.mapper';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly years: SchoolYearsService,
  ) {}

  /** Students, each with their class in the school year asked for. */
  async findAll(query: StudentQueryDto): Promise<Paginated<StudentDto>> {
    const year = await this.years.resolveYear(query.schoolYearId);
    const inYear = { schoolYearId: year.id };
    /** Finished the last grade before that year: they left the school. */
    const graduated: Prisma.StudentWhereInput = {
      enrollments: {
        some: {
          outcome: YearOutcome.GRADUATED,
          schoolYear: { startYear: { lt: year.startYear } },
        },
      },
    };
    const filters: Prisma.StudentWhereInput[] = [
      ...(query.classId
        ? [{ enrollments: { some: { ...inYear, classId: query.classId } } }]
        : []),
      // Without a class that year, graduates (who left) excepted.
      ...(query.unassigned === true
        ? [{ enrollments: { none: inYear } }, { NOT: graduated }]
        : []),
      ...(query.unassigned === false
        ? [{ enrollments: { some: inYear } }]
        : []),
      ...(query.graduated === true ? [graduated] : []),
      ...(query.graduated === false ? [{ NOT: graduated }] : []),
    ];
    const where: Prisma.StudentWhereInput = {
      ...(filters.length > 0 && { AND: filters }),
      ...(query.search && {
        OR: [
          // "2026-0042", "2026-42" or part of one, like "0042".
          {
            registrationNumber: {
              contains:
                parseRegistrationNumber(query.search) ?? query.search.trim(),
            },
          },
          {
            user: {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }),
    };

    const orderBy: Prisma.StudentOrderByWithRelationInput =
      query.sort === 'dateOfBirth' || query.sort === 'registrationNumber'
        ? { [query.sort]: query.order }
        : { user: { [query.sort]: query.order } };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        select: studentSelect(year.id),
        orderBy,
        ...pageArgs(query),
      }),
      this.prisma.student.count({ where }),
    ]);

    return paginated(
      rows.map((row) => toStudentDto(row, year.id)),
      total,
      query,
    );
  }

  /** A student with their class in a school year and their classes so far. */
  async findOne(id: string, schoolYearId?: string): Promise<StudentDetailDto> {
    const year = await this.years.resolveYear(schoolYearId);
    const [student, history] = await Promise.all([
      this.prisma.student.findUnique({
        where: { id },
        select: studentSelect(year.id),
      }),
      this.prisma.enrollment.findMany({
        where: { studentId: id },
        select: {
          outcome: true,
          class: { select: { id: true, name: true } },
          schoolYear: { select: { id: true, startYear: true } },
        },
        orderBy: { schoolYear: { startYear: 'desc' } },
      }),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    return {
      ...toStudentDto(student, year.id),
      history: history.map((h) => ({
        schoolYear: {
          id: h.schoolYear.id,
          name: yearName(h.schoolYear.startYear),
        },
        class: h.class,
        outcome: h.outcome,
      })),
    };
  }

  async create(dto: CreateStudentDto): Promise<StudentDto> {
    await this.users.assertEmailAvailable(dto.email);
    const schoolYearId = await this.openYearClass(dto.classId);
    const passwordHash = await hashPassword(dto.password);
    const year = Number(todayInSchool().slice(0, 4));

    return this.insert(
      dto,
      passwordHash,
      formatRegistrationNumber(year, await this.nextRegistrationNumber(year)),
      schoolYearId,
    );
  }

  /**
   * Takes the next registration number of the year, atomically (two students
   * created at the same moment get different numbers). A number is never
   * given again, even after its student is deleted. The counter also skips
   * past numbers already in use (e.g. students added without it, by a seed).
   */
  private async nextRegistrationNumber(year: number): Promise<number> {
    const highest = await this.prisma.student.findFirst({
      where: { registrationNumber: { startsWith: `${year}-` } },
      orderBy: { registrationNumber: 'desc' },
      select: { registrationNumber: true },
    });
    const afterHighest = nextNumberInYear(highest?.registrationNumber ?? null);
    const [counter] = await this.prisma.$queryRaw<{ last_number: number }[]>`
      INSERT INTO registration_counters (year, last_number)
      VALUES (${year}, ${afterHighest})
      ON CONFLICT (year) DO UPDATE
      SET last_number = GREATEST(
        registration_counters.last_number + 1,
        EXCLUDED.last_number
      )
      RETURNING last_number`;
    return counter.last_number;
  }

  private async insert(
    dto: CreateStudentDto,
    passwordHash: string,
    registrationNumber: string,
    schoolYearId: string,
  ): Promise<StudentDto> {
    // Nested create: the user, the student profile and the enrollment are
    // inserted in one transaction.
    const student = await this.prisma.student.create({
      data: {
        registrationNumber,
        dateOfBirth: new Date(dto.dateOfBirth),
        enrollments: dto.classId
          ? { create: { classId: dto.classId, schoolYearId } }
          : undefined,
        user: {
          create: {
            email: dto.email,
            passwordHash,
            role: Role.STUDENT,
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
        },
      },
      select: studentSelect(schoolYearId),
    });
    return toStudentDto(student, schoolYearId);
  }

  /**
   * `classId` moves the student to another class of the open year (or takes
   * them out of their class, with null).
   */
  async update(id: string, dto: UpdateStudentDto): Promise<StudentDto> {
    const { userId } = await this.getUserId(id);
    const schoolYearId = await this.openYearClass(dto.classId);

    const student = await this.prisma.student.update({
      where: { id },
      data: {
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        enrollments: this.enrollmentChange(id, dto.classId, schoolYearId),
        user: { update: await this.users.buildAccountUpdate(userId, dto) },
      },
      select: studentSelect(schoolYearId),
    });
    if (dto.password) await this.users.endSessions(userId);
    return toStudentDto(student, schoolYearId);
  }

  /** Deletes the student's account together with their grades. */
  async remove(id: string): Promise<void> {
    const { userId } = await this.getUserId(id);
    await this.prisma.user.delete({ where: { id: userId } });
    await this.users.endSessions(userId);
  }

  /**
   * The open school year's id, after checking that the class (if any) is one
   * of its classes: students are only enrolled in the current year here.
   */
  private async openYearClass(classId?: string | null): Promise<string> {
    const year = await this.years.active();
    if (!classId) return year.id;
    const schoolClass = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { schoolYearId: true },
    });
    if (!schoolClass) throw new NotFoundException('Class not found');
    if (schoolClass.schoolYearId !== year.id) {
      throw new BadRequestException(
        `Students can only be enrolled in a class of ${yearName(year.startYear)}`,
      );
    }
    return year.id;
  }

  /** undefined = leave as is, null = unenroll, id = move to that class. */
  private enrollmentChange(
    studentId: string,
    classId: string | null | undefined,
    schoolYearId: string,
  ): Prisma.StudentUpdateInput['enrollments'] {
    if (classId === undefined) return undefined;
    if (classId === null) return { deleteMany: { schoolYearId } };
    return {
      upsert: {
        where: { studentId_schoolYearId: { studentId, schoolYearId } },
        create: { classId, schoolYearId },
        update: { classId },
      },
    };
  }

  private async getUserId(id: string): Promise<{ userId: string }> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }
}
