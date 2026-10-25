import type { Weekday } from '../generated/prisma/client';

/**
 * Things that happened, published by the modules that make them happen
 * (grades, timetable, classes...) after their transaction commits. The
 * notifications module listens to them; the publishers don't know about it.
 */
export const DomainEvents = {
  GradesChanged: 'grades.changed',
  TimetableChanged: 'timetable.changed',
  AssignmentsChanged: 'assignments.changed',
  SessionEnded: 'session.ended',
  LectureShared: 'lecture.shared',
  AbsencesRecorded: 'absences.recorded',
} as const;

export interface GradeChange {
  kind: 'created' | 'updated' | 'deleted';
  gradeId: string;
  studentId: string;
  /** The new value, or the value of the deleted grade. */
  value: number;
  /** YYYY-MM-DD: the new date, or the date of the deleted grade. */
  date: string;
  /** Before an update. */
  oldValue?: number;
  oldDate?: string;
}

export interface GradesChangedEvent {
  /** The user who made the change (never notified about it). */
  actorId: string;
  subjectId: string;
  /** The school year and semester of the grades. */
  schoolYearId: string;
  semester: number;
  changes: GradeChange[];
}

/** A lesson as it was at one moment, with the names needed to describe it. */
export interface LessonSnapshot {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherUserId: string | null;
  teacherName: string | null;
  day: Weekday;
  period: number;
  room: string | null;
}

/** The lessons of some classes before and after a change. */
export interface TimetableChangedEvent {
  classIds: string[];
  before: LessonSnapshot[];
  after: LessonSnapshot[];
}

export type AssignmentChange =
  | {
      kind: 'assigned' | 'unassigned';
      teacherUserId: string;
      classId: string;
      className: string;
      subjectName: string;
      hoursPerWeek: number;
    }
  | {
      kind: 'hours';
      teacherUserId: string;
      classId: string;
      className: string;
      subjectName: string;
      from: number;
      to: number;
    }
  | {
      kind: 'homeroom-assigned' | 'homeroom-removed';
      teacherUserId: string;
      classId: string;
      className: string;
    };

export interface AssignmentsChangedEvent {
  changes: AssignmentChange[];
}

/** The user logged out: every token they had is invalid now. */
export interface SessionEndedEvent {
  userId: string;
}

/** A teacher let some students read a lecture (new readers only). */
export interface LectureSharedEvent {
  actorId: string;
  lectureId: string;
  title: string;
  subjectName: string;
  teacherName: string | null;
  studentIds: string[];
}

/** Absences were recorded in one subject of a class (attendance). */
export interface AbsencesRecordedEvent {
  actorId: string;
  classId: string;
  subjectId: string;
  /** The limit of unexcused absences per semester; null: none. */
  maxAbsences: number | null;
  /** Each student's unexcused absences in the subject and semester, before and after. */
  counts: { studentId: string; before: number; after: number }[];
}
