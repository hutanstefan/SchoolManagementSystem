import { subjectSummarySelect } from '../common/mappers';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginated, pageArgs, paginated } from '../common/dto/pagination.dto';
import { hashPassword } from '../common/password';
import { Prisma, Role } from '../generated/prisma/client';
import { compareClassNames } from '../classes/class-names';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolYearsService } from '../school-years/school-years.service';
import { UsersService } from '../users/users.service';
import {
  CreateTeacherDto,
  TeacherDetailDto,
  TeacherDto,
  TeacherQueryDto,
  UpdateTeacherDto,
} from './dto/teacher.dto';

const teacherSelect = {
  id: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
  },
} as const satisfies Prisma.TeacherSelect;

type TeacherRow = Prisma.TeacherGetPayload<{ select: typeof teacherSelect }>;

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly years: SchoolYearsService,
    private readonly users: UsersService,
  ) {}

  async findAll(query: TeacherQueryDto): Promise<Paginated<TeacherDto>> {
    const where: Prisma.TeacherWhereInput = query.search
      ? {
          user: {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        }
      : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.teacher.findMany({
        where,
        select: teacherSelect,
        orderBy: { user: { [query.sort]: query.order } },
        ...pageArgs(query),
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return paginated(rows.map(toTeacherDto), total, query);
  }

  /** The profile of the logged-in teacher, with their classes and subjects. */
  async findMe(
    userId: string,
    schoolYearId?: string,
  ): Promise<TeacherDetailDto> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!teacher) throw new NotFoundException('Teacher profile not found');
    return this.findOne(teacher.id, schoolYearId);
  }

  /** A teacher with their classes and subjects in a school year (the open one by default). */
  async findOne(id: string, schoolYearId?: string): Promise<TeacherDetailDto> {
    const year = await this.years.resolveYear(schoolYearId);
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      select: {
        ...teacherSelect,
        homeroomClasses: {
          where: { schoolYearId: year.id },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
        classSubjects: {
          where: { class: { schoolYearId: year.id } },
          select: {
            id: true,
            hoursPerWeek: true,
            class: { select: { id: true, name: true } },
            subject: { select: subjectSummarySelect },
          },
          orderBy: [{ class: { name: 'asc' } }, { subject: { name: 'asc' } }],
        },
      },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    // The database sorts names as text ("10A" < "9A"); classes read better in natural order.
    const byClassName = (a: { name: string }, b: { name: string }) =>
      compareClassNames(a.name, b.name);

    return {
      ...toTeacherDto(teacher),
      homeroomClasses: [...teacher.homeroomClasses].sort(byClassName),
      teaching: [...teacher.classSubjects]
        .sort((a, b) => byClassName(a.class, b.class))
        .map((cs) => ({
          classSubjectId: cs.id,
          class: cs.class,
          subject: cs.subject,
          hoursPerWeek: cs.hoursPerWeek,
        })),
    };
  }

  async create(dto: CreateTeacherDto): Promise<TeacherDto> {
    await this.users.assertEmailAvailable(dto.email);

    // Nested create: the user and the teacher profile are inserted in one transaction.
    const teacher = await this.prisma.teacher.create({
      data: {
        user: {
          create: {
            email: dto.email,
            passwordHash: await hashPassword(dto.password),
            role: Role.TEACHER,
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
        },
      },
      select: teacherSelect,
    });
    return toTeacherDto(teacher);
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<TeacherDto> {
    const { userId } = await this.getUserId(id);

    const teacher = await this.prisma.teacher.update({
      where: { id },
      data: {
        user: { update: await this.users.buildAccountUpdate(userId, dto) },
      },
      select: teacherSelect,
    });
    if (dto.password) await this.users.endSessions(userId);
    return toTeacherDto(teacher);
  }

  /**
   * Deletes the teacher's account. Their classes lose the homeroom teacher,
   * their subjects become vacant and the grades they gave are kept.
   */
  async remove(id: string): Promise<void> {
    const { userId } = await this.getUserId(id);
    await this.prisma.user.delete({ where: { id: userId } });
    await this.users.endSessions(userId);
  }

  private async getUserId(id: string): Promise<{ userId: string }> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    return teacher;
  }
}

function toTeacherDto(teacher: TeacherRow): TeacherDto {
  return {
    id: teacher.id,
    userId: teacher.user.id,
    email: teacher.user.email,
    firstName: teacher.user.firstName,
    lastName: teacher.user.lastName,
    createdAt: teacher.user.createdAt,
  };
}
