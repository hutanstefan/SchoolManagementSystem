import { formatSlot, fullName } from '../common/mappers';
import type { Prisma, Weekday } from '../generated/prisma/client';
import { lessonSelect, toLesson } from './lessons';
import { TimetableConflictException } from './timetable-conflict.exception';

type Tx = Prisma.TransactionClient;

interface Slot {
  day: Weekday;
  period: number;
  /** Lessons to ignore (the one being moved, or both lessons of a swap). */
  exclude?: string[];
}

/** 409 CLASS_SLOT_TAKEN if the class already has a lesson in this slot. */
export async function assertClassIsFree(
  tx: Tx,
  classId: string,
  { day, period, exclude = [] }: Slot,
): Promise<void> {
  const clash = await tx.timetableEntry.findFirst({
    where: { classId, day, period, id: { notIn: exclude } },
    select: lessonSelect,
  });
  if (clash) {
    throw new TimetableConflictException(
      `${clash.classSubject.class.name} already has ${clash.classSubject.subject.name} on ${formatSlot(day, period)}`,
      { type: 'CLASS_SLOT_TAKEN', day, period, lessons: [toLesson(clash)] },
    );
  }
}

/** 409 TEACHER_BUSY if the teacher teaches another lesson in this slot. */
export async function assertTeacherIsFree(
  tx: Tx,
  teacherId: string | null,
  slot: Slot,
  schoolYearId: string,
): Promise<void> {
  await assertTeacherIsFreeAt(tx, teacherId, [slot], schoolYearId);
}

/**
 * 409 TEACHER_BUSY if the teacher teaches another lesson in any of these
 * slots; the conflict lists every clash, not just the first one.
 */
export async function assertTeacherIsFreeAt(
  tx: Tx,
  teacherId: string | null,
  slots: Slot[],
  schoolYearId: string,
): Promise<void> {
  if (!teacherId || slots.length === 0) return; // a vacant subject can't clash

  // Only lessons of the same school year: last year's timetable is history.
  const clashes = await tx.timetableEntry.findMany({
    where: {
      classSubject: { teacherId, class: { schoolYearId } },
      OR: slots.map(({ day, period, exclude = [] }) => ({
        day,
        period,
        id: { notIn: exclude },
      })),
    },
    select: lessonSelect,
    orderBy: [{ day: 'asc' }, { period: 'asc' }],
  });
  const [first] = clashes;
  if (!first?.classSubject.teacher) return;

  const teacher = fullName(first.classSubject.teacher);
  const message =
    clashes.length === 1
      ? `${teacher} already teaches ${first.classSubject.class.name} on ${formatSlot(first.day, first.period)}`
      : `${teacher} already teaches other classes at ${clashes.length} of these times`;
  throw new TimetableConflictException(message, {
    type: 'TEACHER_BUSY',
    day: slots.length === 1 ? slots[0].day : undefined,
    period: slots.length === 1 ? slots[0].period : undefined,
    lessons: clashes.map(toLesson),
  });
}
