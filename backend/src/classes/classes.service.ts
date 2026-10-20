import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { Paginated, pageArgs, paginated } from '../common/dto/pagination.dto';
import { personSelect, toPerson } from '../common/mappers';
import { Prisma, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StudentDto } from '../students/dto/student.dto';
import { studentSelect, toStudentDto } from '../students/student.mapper';
import {
  ClassDetailDto,
  ClassDto,
  ClassQueryDto,
  CreateClassDto,
  UpdateClassDto,
} from './dto/class.dto';

const classSelect = {
  id: true,
  name: true,
  createdAt: true,
  homeroomTeacher: { select: personSelect },
  _count: { select: { students: true } },
} as const satisfies Prisma.ClassSelect;

type ClassRow = Prisma.ClassGetPayload<{ select: typeof classSelect }>;

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admins see every class, teachers only the classes they are assigned to. */
  async findAll(
    user: AuthUser,
    query: ClassQueryDto,
  ): Promise<Paginated<ClassDto>> {
    const where: Prisma.ClassWhereInput = {
      ...this.visibleTo(user),
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
    };

    if (query.sort === 'name') {
      // Class names need a natural sort ("9A" before "10A"), which SQL ordering
      // can't do on a text column. A school has at most a few dozen classes,
      // so sorting and paging them in memory is cheap.
      const all = await this.prisma.class.findMany({
        where,
        select: classSelect,
      });
      all.sort((a, b) => compareClassNames(a.name, b.name, query.order));
      const { skip, take } = pageArgs(query);
      return paginated(
        all.slice(skip, skip + take).map(toClassDto),
        all.length,
        query,
      );
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.class.findMany({
        where,
        select: classSelect,
        orderBy: { [query.sort]: query.order },
        ...pageArgs(query),
      }),
      this.prisma.class.count({ where }),
    ]);

    return paginated(rows.map(toClassDto), total, query);
  }

  async findOne(user: AuthUser, id: string): Promise<ClassDetailDto> {
    await this.assertCanView(user, id);

    const schoolClass = await this.prisma.class.findUniqueOrThrow({
      where: { id },
      select: {
        ...classSelect,
        subjects: {
          select: {
            id: true,
            hoursPerWeek: true,
            subject: { select: { id: true, name: true } },
            teacher: { select: personSelect },
          },
          orderBy: { subject: { name: 'asc' } },
        },
      },
    });

    return {
      ...toClassDto(schoolClass),
      subjects: schoolClass.subjects.map((cs) => ({
        classSubjectId: cs.id,
        subject: cs.subject,
        teacher: toPerson(cs.teacher),
        hoursPerWeek: cs.hoursPerWeek,
      })),
    };
  }

  async findStudents(user: AuthUser, id: string): Promise<StudentDto[]> {
    await this.assertCanView(user, id);

    const students = await this.prisma.student.findMany({
      where: { classId: id },
      select: studentSelect,
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
    return students.map(toStudentDto);
  }

  async create(dto: CreateClassDto): Promise<ClassDto> {
    await this.assertNameIsFree(dto.name);
    if (dto.homeroomTeacherId) {
      await this.assertTeacherExists(dto.homeroomTeacherId);
    }

    const schoolClass = await this.prisma.class.create({
      data: { name: dto.name, homeroomTeacherId: dto.homeroomTeacherId },
      select: classSelect,
    });
    return toClassDto(schoolClass);
  }

  async update(id: string, dto: UpdateClassDto): Promise<ClassDto> {
    await this.assertExists(id);
    if (dto.name) await this.assertNameIsFree(dto.name, id);
    if (dto.homeroomTeacherId) {
      await this.assertTeacherExists(dto.homeroomTeacherId);
    }

    const schoolClass = await this.prisma.class.update({
      where: { id },
      data: { name: dto.name, homeroomTeacherId: dto.homeroomTeacherId },
      select: classSelect,
    });
    return toClassDto(schoolClass);
  }

  /**
   * Deletes the class with its teaching assignments and timetable.
   * Its students become unassigned; their grades are kept.
   */
  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.class.delete({ where: { id } });
  }

  /** Moves the given students into the class (out of their current class, if any). */
  async assignStudents(
    id: string,
    studentIds: string[],
  ): Promise<StudentDto[]> {
    await this.assertExists(id);

    const found = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true },
    });
    if (found.length !== studentIds.length) {
      const foundIds = new Set(found.map((s) => s.id));
      const missing = studentIds.filter((sid) => !foundIds.has(sid));
      throw new NotFoundException(`Students not found: ${missing.join(', ')}`);
    }

    await this.prisma.student.updateMany({
      where: { id: { in: studentIds } },
      data: { classId: id },
    });

    const students = await this.prisma.student.findMany({
      where: { classId: id },
      select: studentSelect,
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
    return students.map(toStudentDto);
  }

  async unassignStudent(id: string, studentId: string): Promise<void> {
    const { count } = await this.prisma.student.updateMany({
      where: { id: studentId, classId: id },
      data: { classId: null },
    });
    if (count === 0) {
      throw new NotFoundException('Student is not enrolled in this class');
    }
  }

  /**
   * Where-clause limiting classes to the ones a user may see: admins see all,
   * teachers the classes they teach or are homeroom teacher of, students their own class.
   */
  private visibleTo(user: AuthUser): Prisma.ClassWhereInput {
    switch (user.role) {
      case Role.ADMIN:
        return {};
      case Role.TEACHER:
        return {
          OR: [
            { homeroomTeacher: { userId: user.id } },
            { subjects: { some: { teacher: { userId: user.id } } } },
          ],
        };
      case Role.STUDENT:
        return { students: { some: { userId: user.id } } };
    }
  }

  /** 404 if the class doesn't exist, 403 if the user has no access to it. */
  async assertCanView(user: AuthUser, id: string): Promise<void> {
    await this.assertExists(id);
    if (user.role === Role.ADMIN) return;

    const visible = await this.prisma.class.count({
      where: { id, ...this.visibleTo(user) },
    });
    if (visible === 0) {
      throw new ForbiddenException(
        user.role === Role.STUDENT
          ? 'You are not enrolled in this class'
          : 'You are not assigned to this class',
      );
    }
  }

  async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.class.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Class not found');
  }

  private async assertTeacherExists(teacherId: string): Promise<void> {
    const exists = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Teacher not found');
  }

  private async assertNameIsFree(name: string, exceptId?: string) {
    const existing = await this.prisma.class.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A class with this name already exists');
    }
  }
}

/** Natural order: "9A" < "9B" < "10A" < "12A". */
export function compareClassNames(
  a: string,
  b: string,
  order: 'asc' | 'desc' = 'asc',
): number {
  const result = a.localeCompare(b, 'en', { numeric: true });
  return order === 'asc' ? result : -result;
}

function toClassDto(schoolClass: ClassRow): ClassDto {
  return {
    id: schoolClass.id,
    name: schoolClass.name,
    homeroomTeacher: toPerson(schoolClass.homeroomTeacher),
    studentCount: schoolClass._count.students,
    createdAt: schoolClass.createdAt,
  };
}
