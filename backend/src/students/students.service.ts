import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginated, pageArgs, paginated } from '../common/dto/pagination.dto';
import { todayInSchool } from '../common/dates';
import { hashPassword } from '../common/password';
import { Prisma, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  CreateStudentDto,
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
  ) {}

  async findAll(query: StudentQueryDto): Promise<Paginated<StudentDto>> {
    const where: Prisma.StudentWhereInput = {
      ...(query.classId && { classId: query.classId }),
      ...(query.unassigned === true && { classId: null }),
      ...(query.unassigned === false && { classId: { not: null } }),
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
        select: studentSelect,
        orderBy,
        ...pageArgs(query),
      }),
      this.prisma.student.count({ where }),
    ]);

    return paginated(rows.map(toStudentDto), total, query);
  }

  async findOne(id: string): Promise<StudentDto> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: studentSelect,
    });
    if (!student) throw new NotFoundException('Student not found');
    return toStudentDto(student);
  }

  async create(dto: CreateStudentDto): Promise<StudentDto> {
    await this.users.assertEmailAvailable(dto.email);
    if (dto.classId) await this.assertClassExists(dto.classId);
    const passwordHash = await hashPassword(dto.password);
    const year = Number(todayInSchool().slice(0, 4));

    // The next number of the year is the highest one + 1. Two students created
    // at the same moment could pick the same one: the unique index rejects the
    // second insert, which then tries the next number.
    for (let attempt = 1; ; attempt++) {
      const highest = await this.prisma.student.findFirst({
        where: { registrationNumber: { startsWith: `${year}-` } },
        orderBy: { registrationNumber: 'desc' },
        select: { registrationNumber: true },
      });
      const registrationNumber = formatRegistrationNumber(
        year,
        nextNumberInYear(highest?.registrationNumber ?? null),
      );
      try {
        return await this.insert(dto, passwordHash, registrationNumber);
      } catch (error) {
        // The email was checked above, so a duplicate is the number.
        const clash =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!clash || attempt === 5) throw error;
      }
    }
  }

  private async insert(
    dto: CreateStudentDto,
    passwordHash: string,
    registrationNumber: string,
  ): Promise<StudentDto> {
    // Nested create: the user and the student profile are inserted in one transaction.
    const student = await this.prisma.student.create({
      data: {
        registrationNumber,
        dateOfBirth: new Date(dto.dateOfBirth),
        class: dto.classId ? { connect: { id: dto.classId } } : undefined,
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
      select: studentSelect,
    });
    return toStudentDto(student);
  }

  async update(id: string, dto: UpdateStudentDto): Promise<StudentDto> {
    const { userId } = await this.getUserId(id);
    if (dto.classId) await this.assertClassExists(dto.classId);

    const student = await this.prisma.student.update({
      where: { id },
      data: {
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        class: this.classChange(dto.classId),
        user: { update: await this.users.buildAccountUpdate(userId, dto) },
      },
      select: studentSelect,
    });
    return toStudentDto(student);
  }

  /** Deletes the student's account together with their grades. */
  async remove(id: string): Promise<void> {
    const { userId } = await this.getUserId(id);
    await this.prisma.user.delete({ where: { id: userId } });
  }

  /** undefined = leave as is, null = unassign, id = move to that class. */
  private classChange(
    classId: string | null | undefined,
  ): Prisma.StudentUpdateInput['class'] {
    if (classId === undefined) return undefined;
    if (classId === null) return { disconnect: true };
    return { connect: { id: classId } };
  }

  private async assertClassExists(classId: string): Promise<void> {
    const exists = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Class not found');
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
