import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DomainEvents,
  type AssignmentsChangedEvent,
  type GradeChange,
  type GradesChangedEvent,
  type LectureSharedEvent,
  type TimetableChangedEvent,
} from '../events/domain-events';
import { subjectAverage } from '../grades/averages';
import { PrismaService } from '../prisma/prisma.service';
import {
  assignmentMessage,
  gradeMessage,
  lectureMessage,
  lowAverageAlert,
  lowGradeAlert,
  PASSING_GRADE,
  timetableMessage,
} from './messages';
import {
  NotificationsService,
  type NewNotification,
} from './notifications.service';
import {
  diffTimetable,
  lessonOf,
  type TimetableChange,
} from './timetable-diff';

/**
 * Who is told about what. Each handler turns one domain event into
 * notifications; a failure is logged and never undoes the change itself.
 */
@Injectable()
export class NotificationRulesListener {
  private readonly logger = new Logger(NotificationRulesListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * The student hears about every change to their grades. The homeroom
   * teacher hears about a failing grade, or an average that drops under 5.
   */
  @OnEvent(DomainEvents.GradesChanged)
  async onGradesChanged(event: GradesChangedEvent): Promise<void> {
    await this.safely('grades', async () => {
      const studentIds = [...new Set(event.changes.map((c) => c.studentId))];
      const [subject, students, grades] = await Promise.all([
        this.prisma.subject.findUnique({
          where: { id: event.subjectId },
          select: { name: true },
        }),
        this.prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: {
            id: true,
            userId: true,
            user: { select: { firstName: true, lastName: true } },
            // The class of the grades' school year.
            enrollments: {
              where: { schoolYearId: event.schoolYearId },
              select: {
                class: {
                  select: { homeroomTeacher: { select: { userId: true } } },
                },
              },
            },
          },
        }),
        // The grades of that semester as they are now, after the change.
        this.prisma.grade.findMany({
          where: {
            studentId: { in: studentIds },
            subjectId: event.subjectId,
            schoolYearId: event.schoolYearId,
            semester: event.semester,
          },
          select: { id: true, studentId: true, value: true },
        }),
      ]);
      if (!subject) return;

      const out: NewNotification[] = [];
      for (const student of students) {
        const changes = event.changes.filter((c) => c.studentId === student.id);
        for (const change of changes) {
          out.push({
            userId: student.userId,
            ...gradeMessage(change, subject.name),
            link: '/student/grades',
          });
        }

        const homeroomUserId =
          student.enrollments[0]?.class.homeroomTeacher?.userId;
        if (!homeroomUserId || homeroomUserId === event.actorId) continue;

        const now = grades.filter((g) => g.studentId === student.id);
        const after = subjectAverage(now.map((g) => g.value));
        const before = subjectAverage(valuesBefore(now, changes));
        const name = `${student.user.firstName} ${student.user.lastName}`;
        const link = `/teacher/students/${student.id}`;

        const failing = changes.filter(
          (c) => c.kind !== 'deleted' && c.value < PASSING_GRADE,
        );
        for (const change of failing) {
          out.push({
            userId: homeroomUserId,
            ...lowGradeAlert(name, subject.name, change.value, after.average),
            link,
          });
        }
        const dropped =
          after.roundedAverage !== null &&
          after.roundedAverage < PASSING_GRADE &&
          (before.roundedAverage === null ||
            before.roundedAverage >= PASSING_GRADE);
        if (failing.length === 0 && dropped && after.average !== null) {
          out.push({
            userId: homeroomUserId,
            ...lowAverageAlert(name, subject.name, after.average),
            link,
          });
        }
      }
      await this.notifications.notify(out);
    });
  }

  /**
   * The students of the class hear about every change of its timetable; a
   * teacher hears about changes to their own lessons (a new teacher is an
   * assignment change, told separately).
   */
  @OnEvent(DomainEvents.TimetableChanged)
  async onTimetableChanged(event: TimetableChangedEvent): Promise<void> {
    await this.safely('timetable', async () => {
      const changes = diffTimetable(event.before, event.after);
      if (changes.length === 0) return;

      const out: NewNotification[] = [];
      const enrollments = await this.prisma.enrollment.findMany({
        where: { classId: { in: event.classIds } },
        select: { classId: true, student: { select: { userId: true } } },
      });
      for (const { classId, student } of enrollments) {
        const own = changes.filter((c) => lessonOf(c).classId === classId);
        if (own.length === 0) continue;
        out.push({
          userId: student.userId,
          ...timetableMessage(own, 'student'),
          link: '/student/timetable',
        });
      }

      const byTeacher = new Map<string, TimetableChange[]>();
      for (const change of changes) {
        if (change.kind === 'teacher') continue;
        const teacherUserId = lessonOf(change).teacherUserId;
        if (!teacherUserId) continue;
        byTeacher.set(teacherUserId, [
          ...(byTeacher.get(teacherUserId) ?? []),
          change,
        ]);
      }
      for (const [userId, own] of byTeacher) {
        out.push({
          userId,
          ...timetableMessage(own, 'teacher'),
          link: '/teacher/timetable',
        });
      }
      await this.notifications.notify(out);
    });
  }

  /** Teachers hear about the classes and subjects they are given or lose. */
  @OnEvent(DomainEvents.AssignmentsChanged)
  async onAssignmentsChanged(event: AssignmentsChangedEvent): Promise<void> {
    await this.safely('assignments', () =>
      this.notifications.notify(
        event.changes.map((change) => ({
          userId: change.teacherUserId,
          ...assignmentMessage(change),
          link:
            change.kind === 'unassigned' || change.kind === 'homeroom-removed'
              ? '/teacher/classes'
              : `/teacher/classes/${change.classId}`,
        })),
      ),
    );
  }

  /** Students hear about the lectures shared with them. */
  @OnEvent(DomainEvents.LectureShared)
  async onLectureShared(event: LectureSharedEvent): Promise<void> {
    await this.safely('lecture', async () => {
      const students = await this.prisma.student.findMany({
        where: { id: { in: event.studentIds } },
        select: { userId: true },
      });
      const message = lectureMessage(
        event.title,
        event.subjectName,
        event.teacherName,
      );
      await this.notifications.notify(
        students.map(({ userId }) => ({
          userId,
          ...message,
          link: '/student/lectures',
        })),
      );
    });
  }

  private async safely(what: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.error(
        `Could not send the ${what} notifications`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

/** A student's grades in the subject before the changes, from the ones after. */
export function valuesBefore(
  now: { id: string; value: number }[],
  changes: GradeChange[],
): number[] {
  const byId = new Map(changes.map((c) => [c.gradeId, c]));
  const values: number[] = [];
  for (const grade of now) {
    const change = byId.get(grade.id);
    if (change?.kind === 'created') continue;
    values.push(
      change?.kind === 'updated'
        ? (change.oldValue ?? grade.value)
        : grade.value,
    );
  }
  for (const change of changes) {
    if (change.kind === 'deleted') values.push(change.value);
  }
  return values;
}
