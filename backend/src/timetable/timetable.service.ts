import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { ClassesService } from '../classes/classes.service';
import { Prisma, Role, Weekday } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { serializableTransaction } from '../prisma/serializable-transaction';
import { FreeSlotDto } from './dto/timetable-conflict.dto';
import {
  CreateTimetableEntryDto,
  FIRST_PERIOD,
  LAST_PERIOD,
  TimetableDto,
  TimetableLessonDto,
  UpdateTimetableEntryDto,
} from './dto/timetable.dto';
import { lessonSelect, toLesson, type LessonRow } from './lessons';
import { TimetableConflictException } from './timetable-conflict.exception';
import { assertClassIsFree, assertTeacherIsFree } from './timetable-conflicts';

const WEEKDAYS = Object.values(Weekday);
/** The most weekly hours a subject can have (same limit as the DTOs). */
const MAX_HOURS_PER_WEEK = 10;

type Tx = Prisma.TransactionClient;

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
   * Slots where a subject of a class could be scheduled: the class has no
   * lesson there and the subject's teacher teaches no other class.
   */
  async freeSlots(
    classSubjectId: string,
    excludeLessonId?: string,
  ): Promise<FreeSlotDto[]> {
    const classSubject = await this.prisma.classSubject.findUnique({
      where: { id: classSubjectId },
      select: { classId: true, teacherId: true },
    });
    if (!classSubject) throw new NotFoundException('Class subject not found');

    const busy = await this.prisma.timetableEntry.findMany({
      where: {
        id: excludeLessonId ? { not: excludeLessonId } : undefined,
        OR: [
          { classId: classSubject.classId },
          ...(classSubject.teacherId
            ? [{ classSubject: { teacherId: classSubject.teacherId } }]
            : []),
        ],
      },
      select: { day: true, period: true },
    });
    const taken = new Set(busy.map((b) => `${b.day}-${b.period}`));

    const free: FreeSlotDto[] = [];
    for (const day of WEEKDAYS) {
      for (let period = FIRST_PERIOD; period <= LAST_PERIOD; period++) {
        if (!taken.has(`${day}-${period}`)) free.push({ day, period });
      }
    }
    return free;
  }

  /**
   * Adds a lesson. In one serializable transaction it checks that the subject
   * belongs to the class, that the class and the teacher are free in that slot,
   * and that the subject's weekly hours are not exceeded. Conflicts are 409s
   * that describe what is in the way; `replaceLessonId` and `increaseHours`
   * resolve them in the same transaction.
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
      if (dto.replaceLessonId) {
        await this.removeLessonInSlot(tx, dto.replaceLessonId, classId, slot);
      }
      await assertClassIsFree(tx, classId, slot);
      await assertTeacherIsFree(tx, classSubject.teacherId, slot);

      const scheduled = await tx.timetableEntry.findMany({
        where: { classSubjectId: dto.classSubjectId },
        select: lessonSelect,
        orderBy: [{ day: 'asc' }, { period: 'asc' }],
      });
      if (scheduled.length >= classSubject.hoursPerWeek) {
        if (!dto.increaseHours) {
          throw new TimetableConflictException(
            `${classSubject.subject.name} already has ${scheduled.length}/${classSubject.hoursPerWeek} hours scheduled in ${classSubject.class.name}`,
            {
              type: 'WEEKLY_HOURS_FULL',
              classSubjectId: dto.classSubjectId,
              hoursPerWeek: classSubject.hoursPerWeek,
              lessons: scheduled.map(toLesson),
            },
          );
        }
        if (scheduled.length + 1 > MAX_HOURS_PER_WEEK) {
          throw new BadRequestException(
            `A subject can have at most ${MAX_HOURS_PER_WEEK} hours a week`,
          );
        }
        await tx.classSubject.update({
          where: { id: dto.classSubjectId },
          data: { hoursPerWeek: scheduled.length + 1 },
        });
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

  /**
   * Moves a lesson to another slot and/or room, with the same conflict checks.
   * If the class already has a lesson in the new slot, `swap` exchanges the
   * two lessons and `replaceLessonId` removes the other one.
   */
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

      const target = {
        day: dto.day ?? current.day,
        period: dto.period ?? current.period,
      };
      const moving =
        target.day !== current.day || target.period !== current.period;

      if (moving) {
        const occupant = await tx.timetableEntry.findFirst({
          where: { classId: current.classId, ...target, id: { not: id } },
          select: {
            id: true,
            classSubjectId: true,
            room: true,
            classSubject: { select: { teacherId: true } },
          },
        });

        if (occupant && dto.swap) {
          // Each teacher must be free in the slot their lesson moves to.
          const both = [id, occupant.id];
          await assertTeacherIsFree(tx, current.classSubject.teacherId, {
            ...target,
            exclude: both,
          });
          await assertTeacherIsFree(tx, occupant.classSubject.teacherId, {
            day: current.day,
            period: current.period,
            exclude: both,
          });
          // (class, day, period) is unique, so the other lesson is taken out
          // while this one moves, then put back (same id) in the old slot.
          await tx.timetableEntry.delete({ where: { id: occupant.id } });
          const moved = await tx.timetableEntry.update({
            where: { id },
            data: { ...target, room: dto.room },
            select: lessonSelect,
          });
          await tx.timetableEntry.create({
            data: {
              id: occupant.id,
              classId: current.classId,
              classSubjectId: occupant.classSubjectId,
              day: current.day,
              period: current.period,
              room: occupant.room,
            },
          });
          return toLesson(moved);
        }

        if (dto.replaceLessonId) {
          await this.removeLessonInSlot(
            tx,
            dto.replaceLessonId,
            current.classId,
            target,
          );
        }
        await assertClassIsFree(tx, current.classId, {
          ...target,
          exclude: [id],
        });
        await assertTeacherIsFree(tx, current.classSubject.teacherId, {
          ...target,
          exclude: [id],
        });
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

  /**
   * Removes the lesson that is in the way, but only if it really is the
   * class's lesson in that slot (so a stale page can't delete another lesson).
   */
  private async removeLessonInSlot(
    tx: Tx,
    lessonId: string,
    classId: string,
    slot: { day: Weekday; period: number },
  ): Promise<void> {
    const lesson = await tx.timetableEntry.findUnique({
      where: { id: lessonId },
      select: { classId: true, day: true, period: true },
    });
    if (
      !lesson ||
      lesson.classId !== classId ||
      lesson.day !== slot.day ||
      lesson.period !== slot.period
    ) {
      throw new BadRequestException(
        'The lesson to replace is not in that slot anymore. Reload the timetable and try again.',
      );
    }
    await tx.timetableEntry.delete({ where: { id: lessonId } });
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
