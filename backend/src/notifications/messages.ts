import type { AssignmentChange, GradeChange } from '../events/domain-events';
import type { NotificationType } from '../generated/prisma/client';
import { lessonOf, type TimetableChange } from './timetable-diff';

/**
 * The wording of every notification. Pure functions, so they are easy to
 * test and to change in one place.
 */
export interface Message {
  type: NotificationType;
  title: string;
  body: string;
}

/** "2026-10-17" -> "17 Oct 2026" */
export function formatDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** MONDAY, 3 -> "Monday, period 3" */
export function formatSlot(lesson: { day: string; period: number }): string {
  const day = lesson.day.charAt(0) + lesson.day.slice(1).toLowerCase();
  return `${day}, period ${lesson.period}`;
}

// ------------------------------------------------------------------ grades

/** What the student is told about their own grade. */
export function gradeMessage(
  change: GradeChange,
  subjectName: string,
): Message {
  switch (change.kind) {
    case 'created':
      return {
        type: 'GRADE_ADDED',
        title: `New grade in ${subjectName}: ${change.value}`,
        body: `Given on ${formatDay(change.date)}.`,
      };
    case 'updated': {
      const valueChanged = change.oldValue !== change.value;
      const dateChanged =
        change.oldDate !== undefined && change.oldDate !== change.date;
      return {
        type: 'GRADE_CHANGED',
        title: valueChanged
          ? `Grade changed in ${subjectName}: ${change.oldValue} → ${change.value}`
          : `Grade date changed in ${subjectName}`,
        body: dateChanged
          ? `The ${change.value} is now dated ${formatDay(change.date)} (was ${formatDay(change.oldDate!)}).`
          : `The grade from ${formatDay(change.date)}.`,
      };
    }
    case 'deleted':
      return {
        type: 'GRADE_REMOVED',
        title: `Grade removed in ${subjectName}`,
        body: `The ${change.value} from ${formatDay(change.date)} was removed.`,
      };
  }
}

/** The passing mark: a grade or an average under it needs attention. */
export const PASSING_GRADE = 5;

/** For the homeroom teacher: a student of their class got a failing grade. */
export function lowGradeAlert(
  studentName: string,
  subjectName: string,
  value: number,
  average: number | null,
): Message {
  return {
    type: 'HOMEROOM_ALERT',
    title: `${studentName} got a ${value} in ${subjectName}`,
    body:
      average === null
        ? 'A failing grade for a student of your class.'
        : `Their average in ${subjectName} is now ${average.toFixed(2)}.`,
  };
}

/** For the homeroom teacher: an average dropped under the passing mark. */
export function lowAverageAlert(
  studentName: string,
  subjectName: string,
  average: number,
): Message {
  return {
    type: 'HOMEROOM_ALERT',
    title: `${studentName}'s average in ${subjectName} dropped to ${average.toFixed(2)}`,
    body: `It is under ${PASSING_GRADE} after a grade was changed or removed.`,
  };
}

// --------------------------------------------------------------- timetable

/** Most changes listed in one notification; the rest are counted. */
const MAX_LISTED = 3;

/**
 * One notification about one or more changes of a timetable. Teachers teach
 * several classes, so their wording names the class.
 */
export function timetableMessage(
  changes: TimetableChange[],
  audience: 'student' | 'teacher',
): Message {
  const withClass = audience === 'teacher';
  if (changes.length === 1) {
    const { title, body } = describeChange(changes[0], withClass);
    return { type: 'TIMETABLE_CHANGED', title, body };
  }
  const lines = changes
    .slice(0, MAX_LISTED)
    .map((change) => shortLine(change, withClass));
  const more = changes.length - MAX_LISTED;
  return {
    type: 'TIMETABLE_CHANGED',
    title: `Your timetable changed (${changes.length} changes)`,
    body: lines.join('; ') + (more > 0 ? `; and ${more} more.` : '.'),
  };
}

function subjectLabel(change: TimetableChange, withClass: boolean): string {
  const lesson = lessonOf(change);
  return withClass
    ? `${lesson.subjectName} in ${lesson.className}`
    : lesson.subjectName;
}

function room(room: string | null): string {
  return room ?? 'no room';
}

function describeChange(
  change: TimetableChange,
  withClass: boolean,
): { title: string; body: string } {
  const subject = subjectLabel(change, withClass);
  switch (change.kind) {
    case 'added':
      return {
        title: `New lesson: ${subject}`,
        body: `${formatSlot(change.lesson)}${change.lesson.room ? ` · ${change.lesson.room}` : ''}.`,
      };
    case 'removed':
      return {
        title: `Lesson removed: ${subject}`,
        body: `${formatSlot(change.lesson)} is no longer in the timetable.`,
      };
    case 'moved':
      return {
        title: `${subject} moved`,
        body:
          `${formatSlot(change.before)} → ${formatSlot(change.after)}` +
          (change.before.room !== change.after.room
            ? `, now in ${room(change.after.room)}.`
            : '.'),
      };
    case 'room':
      return {
        title: `${subject} changed room`,
        body: `${formatSlot(change.after)}: ${room(change.before.room)} → ${room(change.after.room)}.`,
      };
    case 'teacher':
      return {
        title: `New teacher for ${subject}`,
        body: change.after.teacherName
          ? `${change.after.teacherName} teaches ${change.after.subjectName} from now on.`
          : `${change.after.subjectName} has no teacher assigned for now.`,
      };
  }
}

function shortLine(change: TimetableChange, withClass: boolean): string {
  const subject = subjectLabel(change, withClass);
  switch (change.kind) {
    case 'added':
      return `new: ${subject}, ${formatSlot(change.lesson)}`;
    case 'removed':
      return `removed: ${subject}, ${formatSlot(change.lesson)}`;
    case 'moved':
      return `${subject}: ${formatSlot(change.before)} → ${formatSlot(change.after)}`;
    case 'room':
      return `${subject}, ${formatSlot(change.after)}: now in ${room(change.after.room)}`;
    case 'teacher':
      return `${subject} now taught by ${change.after.teacherName ?? 'nobody yet'}`;
  }
}

// ------------------------------------------------------------- assignments

export function assignmentMessage(change: AssignmentChange): Message {
  const type = 'ASSIGNMENT_CHANGED';
  switch (change.kind) {
    case 'assigned':
      return {
        type,
        title: `You teach ${change.subjectName} in ${change.className}`,
        body: `${change.hoursPerWeek} ${change.hoursPerWeek === 1 ? 'hour' : 'hours'} a week. The class is in "My classes" now.`,
      };
    case 'unassigned':
      return {
        type,
        title: `You no longer teach ${change.subjectName} in ${change.className}`,
        body: 'Its lessons are no longer in your timetable.',
      };
    case 'hours':
      return {
        type,
        title: `${change.subjectName} in ${change.className}: ${change.to} hours a week`,
        body: `Changed from ${change.from} to ${change.to} hours a week.`,
      };
    case 'homeroom-assigned':
      return {
        type,
        title: `You are the homeroom teacher of ${change.className}`,
        body: "You can see the class's gradebook in every subject, and you'll be told about failing grades.",
      };
    case 'homeroom-removed':
      return {
        type,
        title: `You are no longer the homeroom teacher of ${change.className}`,
        body: "You'll no longer see the gradebooks of the class's other subjects.",
      };
  }
}

// ---------------------------------------------------------------- lectures

export function lectureMessage(
  title: string,
  subjectName: string,
  teacherName: string | null,
): Message {
  return {
    type: 'LECTURE_SHARED',
    title: `New lecture in ${subjectName}: ${title}`,
    body: `${teacherName ?? 'Your teacher'} shared it with you. Open it from Lectures.`,
  };
}
