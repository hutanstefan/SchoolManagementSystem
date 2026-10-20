import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { ClassesService } from '../classes/classes.service';
import { personSelect, toPerson } from '../common/mappers';
import { Prisma, Role, Weekday } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { serializableTransaction } from '../prisma/serializable-transaction';
import {
  CreateTimetableEntryDto,
  TimetableDto,
  TimetableLessonDto,
  UpdateTimetableEntryDto,
} from './dto/timetable.dto';
import { assertClassIsFree, assertTeacherIsFree } from './timetable-conflicts';

const WEEKDAYS = Object.values(Weekday);

const lessonSelect = {
  id: true,
  day: true,
  period: true,
  room: true,
  classSubject: {
    select: {
      id: true,
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: personSelect },
    },
  },
} as const satisfies Prisma.TimetableEntrySelect;

type LessonRow = Prisma.TimetableEntryGetPayload<{
  select: typeof lessonSelect;
}>;

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
  ) {}

  /** A class timetable: for admins, the class's teachers and its students. */
  async forClass(user: AuthUser, classId: string): Promise<TimetableDto> {
    await this.classes.assertCanView(user, classId);
    return this.week({ classId });
  }

  /** Everything a teacher teaches, across all their classes. */
  async forTeacher(teacherId: string): Promise<TimetableDto> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    return this.week({ classSubject: { teacherId } });
  }

  /** "My timetable": a teacher's own lessons, or a student's class timetable. */
  async forCurrentUser(user: AuthUser): Promise<TimetableDto> {
    if (user.role === Role.TEACHER) {
      return this.week({ classSubject: { teacher: { userId: user.id } } });
    }
    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findUnique({
        where: { userId: user.id },
        select: { classId: true },
      });
      // A student without a class has an empty week.
      return student?.classId
        ? this.week({ classId: student.classId })
        : toWeek([]);
    }
    throw new ForbiddenException('Admins have no personal timetable');
  }

  /**
   * Adds a lesson. In one serializable transaction it checks that the subject
   * belongs to the class, that the class and the teacher are free in that slot,
   * and that the subject's weekly hours are not exceeded.
   */
  async create(
    classId: string,
    dto: CreateTimetableEntryDto,
  ): Promise<TimetableLessonDto> {
    await this.classes.assertExists(classId);

    return serializableTransaction(this.prisma, async (tx) => {
      const classSubject = await tx.classSubject.findUnique({
        where: { id: dto.classSubjectId },
        select: {
          classId: true,
          teacherId: true,
          hoursPerWeek: true,
          class: { select: { name: true } },
          subject: { select: { name: true } },
          _count: { select: { timetableEntries: true } },
        },
      });
      if (!classSubject) {
        throw new NotFoundException('Class subject not found');
      }
      if (classSubject.classId !== classId) {
        throw new BadRequestException(
          'This subject is not taught in this class',
        );
      }

      const slot = { day: dto.day, period: dto.period };
      await assertClassIsFree(tx, classId, slot);
      await assertTeacherIsFree(tx, classSubject.teacherId, slot);

      const scheduled = classSubject._count.timetableEntries;
      if (scheduled >= classSubject.hoursPerWeek) {
        throw new ConflictException(
          `${classSubject.subject.name} already has ${scheduled}/${classSubject.hoursPerWeek} hours scheduled in ${classSubject.class.name}`,
        );
      }

      const lesson = await tx.timetableEntry.create({
        data: {
          classSubjectId: dto.classSubjectId,
          classId,
          day: dto.day,
          period: dto.period,
          room: dto.room,
        },
        select: lessonSelect,
      });
      return toLesson(lesson);
    });
  }

  /** Moves a lesson to another slot and/or room, with the same conflict checks. */
  async update(
    id: string,
    dto: UpdateTimetableEntryDto,
  ): Promise<TimetableLessonDto> {
    return serializableTransaction(this.prisma, async (tx) => {
      const current = await tx.timetableEntry.findUnique({
        where: { id },
        select: {
          classId: true,
          day: true,
          period: true,
          classSubject: { select: { teacherId: true } },
        },
      });
      if (!current) throw new NotFoundException('Lesson not found');

      const slot = {
        day: dto.day ?? current.day,
        period: dto.period ?? current.period,
        excludeEntryId: id,
      };
      if (slot.day !== current.day || slot.period !== current.period) {
        await assertClassIsFree(tx, current.classId, slot);
        await assertTeacherIsFree(tx, current.classSubject.teacherId, slot);
      }

      const lesson = await tx.timetableEntry.update({
        where: { id },
        data: { day: dto.day, period: dto.period, room: dto.room },
        select: lessonSelect,
      });
      return toLesson(lesson);
    });
  }

  async remove(id: string): Promise<void> {
    const lesson = await this.prisma.timetableEntry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.prisma.timetableEntry.delete({ where: { id } });
  }

  private async week(
    where: Prisma.TimetableEntryWhereInput,
  ): Promise<TimetableDto> {
    const lessons = await this.prisma.timetableEntry.findMany({
      where,
      select: lessonSelect,
    });
    return toWeek(lessons);
  }
}

function toLesson(row: LessonRow): TimetableLessonDto {
  return {
    id: row.id,
    day: row.day,
    period: row.period,
    room: row.room,
    classSubjectId: row.classSubject.id,
    class: row.classSubject.class,
    subject: row.classSubject.subject,
    teacher: toPerson(row.classSubject.teacher),
  };
}

/** Groups lessons into Monday..Friday, each day sorted by period. */
export function toWeek(rows: LessonRow[]): TimetableDto {
  return {
    days: WEEKDAYS.map((day) => ({
      day,
      lessons: rows
        .filter((row) => row.day === day)
        .sort(
          (a, b) =>
            a.period - b.period ||
            a.classSubject.class.name.localeCompare(b.classSubject.class.name),
        )
        .map(toLesson),
    })),
  };
}
