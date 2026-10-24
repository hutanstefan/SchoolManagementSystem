import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  personSelect,
  toPerson,
  subjectSummarySelect,
} from '../common/mappers';
import { ClassSubjectSummaryDto } from '../classes/dto/class.dto';
import {
  DomainEvents,
  type AssignmentChange,
  type AssignmentsChangedEvent,
  type TimetableChangedEvent,
} from '../events/domain-events';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolYearsService } from '../school-years/school-years.service';
import { serializableTransaction } from '../prisma/serializable-transaction';
import { snapshotLessons } from '../timetable/lesson-snapshots';
import { lessonSelect, toLesson } from '../timetable/lessons';
import { TimetableConflictException } from '../timetable/timetable-conflict.exception';
import { assertTeacherIsFreeAt } from '../timetable/timetable-conflicts';
import {
  CreateClassSubjectDto,
  UpdateClassSubjectDto,
} from './dto/class-subject.dto';

const classSubjectSelect = {
  id: true,
  hoursPerWeek: true,
  subject: { select: subjectSummarySelect },
  teacher: { select: { ...personSelect, userId: true } },
} as const satisfies Prisma.ClassSubjectSelect;

type ClassSubjectRow = Prisma.ClassSubjectGetPayload<{
  select: typeof classSubjectSelect;
}>;

/** Teaching assignments: which subjects a class studies, who teaches them, how many hours. */
@Injectable()
export class ClassSubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly years: SchoolYearsService,
  ) {}

  /** Only classes of the open year can change (a closed year is an archive). */
  async create(
    classId: string,
    dto: CreateClassSubjectDto,
  ): Promise<ClassSubjectSummaryDto> {
    await this.years.assertClassOpen(classId);
    const [schoolClass, subject] = await Promise.all([
      this.prisma.class.findUnique({
        where: { id: classId },
        select: { name: true },
      }),
      this.prisma.subject.findUnique({
        where: { id: dto.subjectId },
        select: { name: true },
      }),
    ]);
    if (!schoolClass) throw new NotFoundException('Class not found');
    if (!subject) throw new NotFoundException('Subject not found');
    if (dto.teacherId) await this.assertTeacherExists(dto.teacherId);

    const existing = await this.prisma.classSubject.findUnique({
      where: {
        classId_subjectId: { classId, subjectId: dto.subjectId },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `${subject.name} is already taught in ${schoolClass.name}`,
      );
    }

    const created = await this.prisma.classSubject.create({
      data: {
        classId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        hoursPerWeek: dto.hoursPerWeek,
      },
      select: classSubjectSelect,
    });
    await this.publishAssignments(
      created.teacher
        ? [
            {
              kind: 'assigned',
              teacherUserId: created.teacher.userId,
              classId,
              className: schoolClass.name,
              subjectName: subject.name,
              hoursPerWeek: created.hoursPerWeek,
            },
          ]
        : [],
    );
    return toSummary(created);
  }

  /**
   * Changes the teacher or the weekly hours. Both changes are checked against
   * the timetable, inside one serializable transaction. `removeLessonIds`
   * takes lessons out of the timetable first, e.g. to lower the hours.
   */
  async update(
    id: string,
    dto: UpdateClassSubjectDto,
  ): Promise<ClassSubjectSummaryDto> {
    if (dto.teacherId) await this.assertTeacherExists(dto.teacherId);
    const existing = await this.prisma.classSubject.findUnique({
      where: { id },
      select: { classId: true },
    });
    if (!existing) throw new NotFoundException('Class subject not found');
    const year = await this.years.assertClassOpen(existing.classId);
    const classIds = [existing.classId];

    const { summary, before, after, changes } = await serializableTransaction(
      this.prisma,
      async (tx) => {
        const before = await snapshotLessons(tx, classIds);
        const current = await tx.classSubject.findUnique({
          where: { id },
          select: {
            teacherId: true,
            hoursPerWeek: true,
            teacher: { select: { userId: true } },
            class: { select: { id: true, name: true } },
            subject: { select: { name: true } },
          },
        });
        if (!current) throw new NotFoundException('Class subject not found');

        if (dto.removeLessonIds?.length) {
          const removed = await tx.timetableEntry.deleteMany({
            where: { id: { in: dto.removeLessonIds }, classSubjectId: id },
          });
          if (removed.count !== dto.removeLessonIds.length) {
            throw new BadRequestException(
              `Some of the lessons to remove are not ${current.subject.name} lessons of ${current.class.name}`,
            );
          }
        }

        const lessons = await tx.timetableEntry.findMany({
          where: { classSubjectId: id },
          select: lessonSelect,
          orderBy: [{ day: 'asc' }, { period: 'asc' }],
        });
        if (
          dto.hoursPerWeek !== undefined &&
          dto.hoursPerWeek < lessons.length
        ) {
          throw new TimetableConflictException(
            `${current.subject.name} has ${lessons.length} lessons in the ${current.class.name} timetable. ` +
              `Remove ${lessons.length - dto.hoursPerWeek} of them before lowering the hours to ${dto.hoursPerWeek}.`,
            {
              type: 'HOURS_BELOW_SCHEDULED',
              classSubjectId: id,
              hoursPerWeek: dto.hoursPerWeek,
              lessons: lessons.map(toLesson),
            },
          );
        }

        // The new teacher must be free at every time this subject is scheduled.
        if (dto.teacherId && dto.teacherId !== current.teacherId) {
          await assertTeacherIsFreeAt(
            tx,
            dto.teacherId,
            lessons.map((lesson) => ({
              day: lesson.day,
              period: lesson.period,
              exclude: [lesson.id],
            })),
            year.id,
          );
        }

        const updated = await tx.classSubject.update({
          where: { id },
          data: { teacherId: dto.teacherId, hoursPerWeek: dto.hoursPerWeek },
          select: classSubjectSelect,
        });
        const after = await snapshotLessons(tx, classIds);
        return {
          summary: toSummary(updated),
          before,
          after,
          changes: assignmentChanges(current, updated),
        };
      },
    );
    await this.events.emitAsync(DomainEvents.TimetableChanged, {
      classIds,
      before,
      after,
    } satisfies TimetableChangedEvent);
    await this.publishAssignments(changes);
    return summary;
  }

  /** Removes the subject from the class with its lessons. Grades are kept. */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.classSubject.findUnique({
      where: { id },
      select: {
        classId: true,
        hoursPerWeek: true,
        teacher: { select: { userId: true } },
        class: { select: { name: true } },
        subject: { select: { name: true } },
      },
    });
    if (!existing) throw new NotFoundException('Class subject not found');
    await this.years.assertClassOpen(existing.classId);
    const classIds = [existing.classId];

    // Its lessons go too (cascade), so the timetable changes.
    const { before, after } = await serializableTransaction(
      this.prisma,
      async (tx) => {
        const before = await snapshotLessons(tx, classIds);
        await tx.classSubject.delete({ where: { id } });
        return { before, after: await snapshotLessons(tx, classIds) };
      },
    );
    await this.events.emitAsync(DomainEvents.TimetableChanged, {
      classIds,
      before,
      after,
    } satisfies TimetableChangedEvent);
    await this.publishAssignments(
      existing.teacher
        ? [
            {
              kind: 'unassigned',
              teacherUserId: existing.teacher.userId,
              classId: existing.classId,
              className: existing.class.name,
              subjectName: existing.subject.name,
              hoursPerWeek: existing.hoursPerWeek,
            },
          ]
        : [],
    );
  }

  private async publishAssignments(changes: AssignmentChange[]): Promise<void> {
    if (changes.length === 0) return;
    await this.events.emitAsync(DomainEvents.AssignmentsChanged, {
      changes,
    } satisfies AssignmentsChangedEvent);
  }

  private async assertTeacherExists(teacherId: string): Promise<void> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
  }
}

function toSummary(row: ClassSubjectRow): ClassSubjectSummaryDto {
  return {
    classSubjectId: row.id,
    subject: row.subject,
    teacher: toPerson(row.teacher),
    hoursPerWeek: row.hoursPerWeek,
  };
}

/** What changed for the teachers when a teaching assignment was updated. */
function assignmentChanges(
  before: {
    hoursPerWeek: number;
    teacher: { userId: string } | null;
    class: { id: string; name: string };
    subject: { name: string };
  },
  after: ClassSubjectRow,
): AssignmentChange[] {
  const where = {
    classId: before.class.id,
    className: before.class.name,
    subjectName: before.subject.name,
  };
  const oldTeacher = before.teacher?.userId ?? null;
  const newTeacher = after.teacher?.userId ?? null;
  const changes: AssignmentChange[] = [];
  if (oldTeacher !== newTeacher) {
    if (oldTeacher) {
      changes.push({
        kind: 'unassigned',
        teacherUserId: oldTeacher,
        hoursPerWeek: before.hoursPerWeek,
        ...where,
      });
    }
    if (newTeacher) {
      changes.push({
        kind: 'assigned',
        teacherUserId: newTeacher,
        hoursPerWeek: after.hoursPerWeek,
        ...where,
      });
    }
  } else if (newTeacher && before.hoursPerWeek !== after.hoursPerWeek) {
    changes.push({
      kind: 'hours',
      teacherUserId: newTeacher,
      from: before.hoursPerWeek,
      to: after.hoursPerWeek,
      ...where,
    });
  }
  return changes;
}
