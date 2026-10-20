import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginated, pageArgs, paginated } from '../common/dto/pagination.dto';
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
        user: {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const orderBy: Prisma.StudentOrderByWithRelationInput =
      query.sort === 'dateOfBirth'
        ? { dateOfBirth: query.order }
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

    // Nested create: the user and the student profile are inserted in one transaction.
    const student = await this.prisma.student.create({
      data: {
        dateOfBirth: new Date(dto.dateOfBirth),
        class: dto.classId ? { connect: { id: dto.classId } } : undefined,
        user: {
          create: {
            email: dto.email,
            passwordHash: await hashPassword(dto.password),
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
