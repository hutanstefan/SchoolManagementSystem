import type { LessonSnapshot } from '../events/domain-events';

/** One difference between two versions of a timetable. */
export type TimetableChange =
  | { kind: 'added'; lesson: LessonSnapshot }
  | { kind: 'removed'; lesson: LessonSnapshot }
  /** Another day or period (the room may have changed too). */
  | { kind: 'moved'; before: LessonSnapshot; after: LessonSnapshot }
  | { kind: 'room'; before: LessonSnapshot; after: LessonSnapshot }
  | { kind: 'teacher'; before: LessonSnapshot; after: LessonSnapshot };

/**
 * Compares lessons by id. Whatever the operation was (a move, a swap, a
 * replacement, lowering the hours, a new teacher...), the difference is what
 * students and teachers need to hear about.
 */
export function diffTimetable(
  before: LessonSnapshot[],
  after: LessonSnapshot[],
): TimetableChange[] {
  const old = new Map(before.map((lesson) => [lesson.id, lesson]));
  const now = new Map(after.map((lesson) => [lesson.id, lesson]));
  const changes: TimetableChange[] = [];
  // A new teacher is per subject: told once, not once per lesson.
  const newTeacherFor = new Set<string>();

  for (const lesson of before) {
    if (!now.has(lesson.id)) changes.push({ kind: 'removed', lesson });
  }
  for (const lesson of after) {
    const previous = old.get(lesson.id);
    if (!previous) {
      changes.push({ kind: 'added', lesson });
    } else if (
      previous.day !== lesson.day ||
      previous.period !== lesson.period
    ) {
      changes.push({ kind: 'moved', before: previous, after: lesson });
    } else if (previous.room !== lesson.room) {
      changes.push({ kind: 'room', before: previous, after: lesson });
    } else if (previous.teacherUserId !== lesson.teacherUserId) {
      const subject = `${lesson.classId}:${lesson.subjectId}`;
      if (!newTeacherFor.has(subject)) {
        newTeacherFor.add(subject);
        changes.push({ kind: 'teacher', before: previous, after: lesson });
      }
    }
  }
  return changes.sort(
    (a, b) => slotOrder(lessonOf(a)) - slotOrder(lessonOf(b)),
  );
}

/** The lesson a change is about, as it is now (or was, if removed). */
export function lessonOf(change: TimetableChange): LessonSnapshot {
  return 'lesson' in change ? change.lesson : change.after;
}

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

function slotOrder(lesson: LessonSnapshot): number {
  return DAY_ORDER.indexOf(lesson.day) * 100 + lesson.period;
}
