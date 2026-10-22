import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { ClassesService } from '../classes/classes.service';
import { todayInSchool, toDateString } from '../common/dates';
import { PersonSummaryDto } from '../common/dto/summaries.dto';
import { Paginated, pageArgs, paginated } from '../common/dto/pagination.dto';
import { personSelect, toPerson } from '../common/mappers';
import { GradeAction, Prisma, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { minimumGrades, overallAverage, subjectAverage } from './averages';
import {
  CreateGradeDto,
  CreateGradesBatchDto,
  GradebookDto,
  GradeDto,
  GradeEntryDto,
  GradeHistoryEntryDto,
  GradeQueryDto,
  GradesBatchResultDto,
  StudentGradesReportDto,
  SubjectGradesDto,
  UpdateGradeDto,
} from './dto/grade.dto';

const gradeSelect = {
  id: true,
  value: true,
  date: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: { ...personSelect, class: { select: { id: true, name: true } } },
  },
  subject: { select: { id: true, name: true } },
  teacher: { select: personSelect },
} as const satisfies Prisma.GradeSelect;

type GradeRow = Prisma.GradeGetPayload<{ select: typeof gradeSelect }>;

const gradeEntrySelect = {
  id: true,
  value: true,
  date: true,
  subjectId: true,
  studentId: true,
  teacher: { select: personSelect },
} as const satisfies Prisma.GradeSelect;

type GradeEntryRow = Prisma.GradeGetPayload<{
  select: typeof gradeEntrySelect;
}>;

@Injectable()
export class GradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
  ) {}

  // ---------------------------------------------------------------- writes

  /**
   * Teachers can only grade a subject they teach, in that student's class.
   * Admins can grade any student; the grade is attributed to the subject's teacher.
   */
  async create(user: AuthUser, dto: CreateGradeDto): Promise<GradeDto> {
    const [student, subject] = await Promise.all([
      this.prisma.student.findUnique({
        where: { id: dto.studentId },
        select: { classId: true, class: { select: { name: true } } },
      }),
      this.prisma.subject.findUnique({
        where: { id: dto.subjectId },
        select: { name: true },
      }),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    if (!subject) throw new NotFoundException('Subject not found');
    if (!student.classId || !student.class) {
      throw new BadRequestException('The student is not enrolled in any class');
    }

    const assignment = await this.prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: student.classId,
          subjectId: dto.subjectId,
        },
      },
      select: { teacher: { select: { id: true, userId: true } } },
    });
    if (!assignment) {
      throw new BadRequestException(
        `${subject.name} is not taught in ${student.class.name}`,
      );
    }
    if (user.role === Role.TEACHER && assignment.teacher?.userId !== user.id) {
      throw new ForbiddenException(
        `You don't teach ${subject.name} in ${student.class.name}`,
      );
    }

    const date = new Date(dto.date ?? todayInSchool());

    // The grade and its audit entry are written together or not at all.
    const grade = await this.prisma.$transaction(async (tx) => {
      const created = await tx.grade.create({
        data: {
          studentId: dto.studentId,
          subjectId: dto.subjectId,
          teacherId: assignment.teacher?.id ?? null,
          value: dto.value,
          date,
        },
        select: gradeSelect,
      });
      await tx.gradeHistory.create({
        data: {
          gradeId: created.id,
          studentId: dto.studentId,
          subjectId: dto.subjectId,
          action: GradeAction.CREATED,
          newValue: dto.value,
          newDate: date,
          changedById: user.id,
        },
      });
      return created;
    });
    return toGradeDto(grade);
  }

  /**
   * Grades for many students of one class in one subject, e.g. read from
   * photos of tests or from a spreadsheet. Saved together or not at all: one
   * invalid entry rejects the whole batch.
   */
  async createMany(
    user: AuthUser,
    classId: string,
    dto: CreateGradesBatchDto,
  ): Promise<GradesBatchResultDto> {
    const { className, teacherId } = await this.assertCanGrade(
      user,
      classId,
      dto.subjectId,
    );

    const studentIds = dto.grades.map((g) => g.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException(
        'Each student can appear only once in a batch',
      );
    }
    const enrolled = await this.prisma.student.count({
      where: { id: { in: studentIds }, classId },
    });
    if (enrolled !== studentIds.length) {
      throw new BadRequestException(
        `${studentIds.length - enrolled} of the students are not in ${className}`,
      );
    }

    const date = new Date(dto.date ?? todayInSchool());
    const created = await this.prisma.$transaction(async (tx) => {
      const grades = await tx.grade.createManyAndReturn({
        data: dto.grades.map((g) => ({
          studentId: g.studentId,
          subjectId: dto.subjectId,
          teacherId,
          value: g.value,
          date,
        })),
        select: { id: true, studentId: true, value: true },
      });
      await tx.gradeHistory.createMany({
        data: grades.map((grade) => ({
          gradeId: grade.id,
          studentId: grade.studentId,
          subjectId: dto.subjectId,
          action: GradeAction.CREATED,
          newValue: grade.value,
          newDate: date,
          changedById: user.id,
        })),
      });
      return grades;
    });
    // createManyAndReturn keeps the input order on PostgreSQL.
    return { count: created.length, gradeIds: created.map((g) => g.id) };
  }

  /**
   * Checks that the user may grade a subject in a class: admins always, a
   * teacher only if they teach it there. Returns the names (for messages) and
   * the subject's teacher, who the grades are attributed to.
   */
  async assertCanGrade(
    user: AuthUser,
    classId: string,
    subjectId: string,
  ): Promise<{
    className: string;
    subjectName: string;
    teacherId: string | null;
  }> {
    const [schoolClass, subject] = await Promise.all([
      this.prisma.class.findUnique({
        where: { id: classId },
        select: { name: true },
      }),
      this.prisma.subject.findUnique({
        where: { id: subjectId },
        select: { name: true },
      }),
    ]);
    if (!schoolClass) throw new NotFoundException('Class not found');
    if (!subject) throw new NotFoundException('Subject not found');

    const assignment = await this.prisma.classSubject.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
      select: { teacher: { select: { id: true, userId: true } } },
    });
    if (!assignment) {
      throw new BadRequestException(
        `${subject.name} is not taught in ${schoolClass.name}`,
      );
    }
    if (user.role === Role.TEACHER && assignment.teacher?.userId !== user.id) {
      throw new ForbiddenException(
        `You don't teach ${subject.name} in ${schoolClass.name}`,
      );
    }
    return {
      className: schoolClass.name,
      subjectName: subject.name,
      teacherId: assignment.teacher?.id ?? null,
    };
  }

  /** Teachers can only change grades they gave themselves. */
  async update(
    user: AuthUser,
    id: string,
    dto: UpdateGradeDto,
  ): Promise<GradeDto> {
    const current = await this.findForChange(user, id);

    const newValue = dto.value ?? current.value;
    const newDate = dto.date ? new Date(dto.date) : current.date;
    const changed =
      newValue !== current.value ||
      toDateString(newDate) !== toDateString(current.date);

    if (!changed) {
      return toGradeDto(
        await this.prisma.grade.findUniqueOrThrow({
          where: { id },
          select: gradeSelect,
        }),
      );
    }

    const grade = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.grade.update({
        where: { id },
        data: { value: newValue, date: newDate },
        select: gradeSelect,
      });
      await tx.gradeHistory.create({
        data: {
          gradeId: id,
          studentId: current.studentId,
          subjectId: current.subjectId,
          action: GradeAction.UPDATED,
          oldValue: current.value,
          newValue,
          oldDate: current.date,
          newDate,
          changedById: user.id,
        },
      });
      return updated;
    });
    return toGradeDto(grade);
  }

  /** Teachers can only delete grades they gave. The history keeps a record. */
  async remove(user: AuthUser, id: string): Promise<void> {
    const current = await this.findForChange(user, id);

    await this.prisma.$transaction([
      this.prisma.gradeHistory.create({
        data: {
          gradeId: id,
          studentId: current.studentId,
          subjectId: current.subjectId,
          action: GradeAction.DELETED,
          oldValue: current.value,
          oldDate: current.date,
          changedById: user.id,
        },
      }),
      this.prisma.grade.delete({ where: { id } }),
    ]);
  }

  // ----------------------------------------------------------------- reads

  /**
   * Paginated grades. Admins see everything. Teachers see the grades of the
   * subjects they teach in each class, every grade of their homeroom classes,
   * and every grade they gave themselves.
   */
  async findAll(
    user: AuthUser,
    query: GradeQueryDto,
  ): Promise<Paginated<GradeDto>> {
    const filters: Prisma.GradeWhereInput[] = [
      query.classId ? { student: { classId: query.classId } } : {},
      query.subjectId ? { subjectId: query.subjectId } : {},
      query.studentId ? { studentId: query.studentId } : {},
      query.search
        ? {
            student: {
              user: {
                OR: [
                  {
                    firstName: { contains: query.search, mode: 'insensitive' },
                  },
                  { lastName: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            },
          }
        : {},
    ];
    if (user.role === Role.TEACHER) {
      filters.push(await this.teacherScope(user.id));
    }
    const where: Prisma.GradeWhereInput = { AND: filters };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.grade.findMany({
        where,
        select: gradeSelect,
        orderBy: [{ [query.sort]: query.order }, { createdAt: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.grade.count({ where }),
    ]);
    return paginated(rows.map(toGradeDto), total, query);
  }

  /** The logged-in student's own report card. */
  async myReport(user: AuthUser): Promise<StudentGradesReportDto> {
    const student = await this.prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return this.buildReport(student.id);
  }

  /** A student's report card, for admins and the teachers of their class. */
  async studentReport(
    user: AuthUser,
    studentId: string,
  ): Promise<StudentGradesReportDto> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (user.role === Role.TEACHER) {
      if (!student.classId) {
        throw new ForbiddenException('You are not assigned to this student');
      }
      await this.classes.assertCanView(user, student.classId);
    }
    return this.buildReport(studentId);
  }

  /**
   * The gradebook of one subject in one class. Open to admins, to the teacher
   * of that subject and to the class's homeroom teacher.
   */
  async gradebook(
    user: AuthUser,
    classId: string,
    subjectId: string,
  ): Promise<GradebookDto> {
    const schoolClass = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        homeroomTeacher: { select: { userId: true } },
      },
    });
    if (!schoolClass) throw new NotFoundException('Class not found');

    const assignment = await this.prisma.classSubject.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
      select: {
        hoursPerWeek: true,
        subject: { select: { id: true, name: true } },
        teacher: { select: { ...personSelect, userId: true } },
      },
    });
    if (!assignment) {
      throw new NotFoundException('This subject is not taught in this class');
    }

    if (
      user.role === Role.TEACHER &&
      assignment.teacher?.userId !== user.id &&
      schoolClass.homeroomTeacher?.userId !== user.id
    ) {
      throw new ForbiddenException(
        `You don't teach ${assignment.subject.name} in ${schoolClass.name}`,
      );
    }

    const students = await this.prisma.student.findMany({
      where: { classId },
      select: personSelect,
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
    const grades = await this.prisma.grade.findMany({
      where: { subjectId, studentId: { in: students.map((s) => s.id) } },
      select: gradeEntrySelect,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    const minimum = minimumGrades(assignment.hoursPerWeek);
    return {
      class: { id: schoolClass.id, name: schoolClass.name },
      subject: assignment.subject,
      teacher: toPerson(assignment.teacher),
      hoursPerWeek: assignment.hoursPerWeek,
      minimumGrades: minimum,
      students: students.map((student) => {
        const own = grades.filter((g) => g.studentId === student.id);
        return {
          student: toPerson(student),
          grades: own.map(toGradeEntry),
          ...subjectAverage(own.map((g) => g.value)),
          hasMinimumGrades: own.length >= minimum,
        };
      }),
    };
  }

  /** Audit trail of one grade, still available after the grade is deleted. */
  async history(gradeId: string): Promise<GradeHistoryEntryDto[]> {
    const entries = await this.prisma.gradeHistory.findMany({
      where: { gradeId },
      orderBy: { changedAt: 'asc' },
      select: {
        id: true,
        gradeId: true,
        action: true,
        oldValue: true,
        newValue: true,
        oldDate: true,
        newDate: true,
        changedAt: true,
        changedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });
    if (entries.length === 0) throw new NotFoundException('Grade not found');

    return entries.map((entry) => ({
      ...entry,
      oldDate: entry.oldDate ? toDateString(entry.oldDate) : null,
      newDate: entry.newDate ? toDateString(entry.newDate) : null,
    }));
  }

  // --------------------------------------------------------------- helpers

  private async findForChange(user: AuthUser, id: string) {
    const grade = await this.prisma.grade.findUnique({
      where: { id },
      select: {
        value: true,
        date: true,
        studentId: true,
        subjectId: true,
        teacher: { select: { userId: true } },
      },
    });
    if (!grade) throw new NotFoundException('Grade not found');
    if (user.role === Role.TEACHER && grade.teacher?.userId !== user.id) {
      throw new ForbiddenException('You can only change grades you gave');
    }
    return grade;
  }

  /** Grades a teacher may see (see findAll). */
  private async teacherScope(userId: string): Promise<Prisma.GradeWhereInput> {
    const [assignments, homeroomClasses] = await Promise.all([
      this.prisma.classSubject.findMany({
        where: { teacher: { userId } },
        select: { classId: true, subjectId: true },
      }),
      this.prisma.class.findMany({
        where: { homeroomTeacher: { userId } },
        select: { id: true },
      }),
    ]);

    return {
      OR: [
        ...assignments.map((a) => ({
          subjectId: a.subjectId,
          student: { classId: a.classId },
        })),
        ...homeroomClasses.map((c) => ({ student: { classId: c.id } })),
        { teacher: { userId } },
      ],
    };
  }

  private async buildReport(
    studentId: string,
  ): Promise<StudentGradesReportDto> {
    const student = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      select: {
        ...personSelect,
        class: {
          select: {
            id: true,
            name: true,
            subjects: {
              select: {
                hoursPerWeek: true,
                subject: { select: { id: true, name: true } },
                teacher: { select: personSelect },
              },
            },
          },
        },
      },
    });
    const grades = await this.prisma.grade.findMany({
      where: { studentId },
      select: {
        ...gradeEntrySelect,
        subject: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    // Subjects of the current class, plus any subject graded in a previous class.
    const classSubjects = student.class?.subjects ?? [];
    const subjectIds = new Set(classSubjects.map((cs) => cs.subject.id));
    const extraSubjects = [
      ...new Map(
        grades
          .filter((g) => !subjectIds.has(g.subjectId))
          .map((g) => [g.subjectId, g.subject]),
      ).values(),
    ];

    const reportSubjects: {
      subject: { id: string; name: string };
      teacher: PersonSummaryDto | null;
      hoursPerWeek: number | null;
    }[] = [
      ...classSubjects.map((cs) => ({
        subject: cs.subject,
        teacher: toPerson(cs.teacher),
        hoursPerWeek: cs.hoursPerWeek,
      })),
      ...extraSubjects.map((subject) => ({
        subject,
        teacher: null,
        hoursPerWeek: null,
      })),
    ];

    const subjects: SubjectGradesDto[] = reportSubjects
      .sort((a, b) => a.subject.name.localeCompare(b.subject.name))
      .map(({ subject, teacher, hoursPerWeek }) => {
        const own = grades.filter((g) => g.subjectId === subject.id);
        const minimum =
          hoursPerWeek === null ? null : minimumGrades(hoursPerWeek);
        return {
          subject,
          teacher,
          grades: own.map(toGradeEntry),
          ...subjectAverage(own.map((g) => g.value)),
          minimumGrades: minimum,
          hasMinimumGrades: minimum === null ? null : own.length >= minimum,
        };
      });

    return {
      student: toPerson(student),
      class: student.class
        ? { id: student.class.id, name: student.class.name }
        : null,
      subjects,
      overallAverage: overallAverage(subjects.map((s) => s.roundedAverage)),
    };
  }
}

function toGradeEntry(row: GradeEntryRow): GradeEntryDto {
  return {
    id: row.id,
    value: row.value,
    date: toDateString(row.date),
    teacher: toPerson(row.teacher),
  };
}

function toGradeDto(row: GradeRow): GradeDto {
  return {
    id: row.id,
    value: row.value,
    date: toDateString(row.date),
    student: toPerson(row.student),
    class: row.student.class,
    subject: row.subject,
    teacher: toPerson(row.teacher),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
