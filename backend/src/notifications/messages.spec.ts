import type { LessonSnapshot } from '../events/domain-events';
import {
  assignmentMessage,
  formatDay,
  gradeMessage,
  lowAverageAlert,
  lowGradeAlert,
  timetableMessage,
} from './messages';
import type { TimetableChange } from './timetable-diff';

const lesson = (overrides: Partial<LessonSnapshot> = {}): LessonSnapshot => ({
  id: 'l-1',
  classId: 'c-9a',
  className: '9A',
  subjectId: 's-math',
  subjectName: 'Mathematics',
  teacherUserId: 'u-mihai',
  teacherName: 'Mihai Ionescu',
  day: 'MONDAY',
  period: 1,
  room: '101',
  ...overrides,
});

describe('notification messages', () => {
  it('formats dates like the app', () => {
    expect(formatDay('2026-10-17')).toBe('17 Oct 2026');
  });

  it('tells a student about a new, changed or removed grade', () => {
    const base = { gradeId: 'g', studentId: 's', date: '2026-10-17' };
    expect(
      gradeMessage({ ...base, kind: 'created', value: 9 }, 'Mathematics'),
    ).toEqual({
      type: 'GRADE_ADDED',
      title: 'New grade in Mathematics: 9',
      body: 'Given on 17 Oct 2026.',
    });
    expect(
      gradeMessage(
        {
          ...base,
          kind: 'updated',
          value: 8,
          oldValue: 5,
          oldDate: '2026-10-17',
        },
        'Mathematics',
      ).title,
    ).toBe('Grade changed in Mathematics: 5 → 8');
    expect(
      gradeMessage(
        {
          ...base,
          kind: 'updated',
          value: 8,
          oldValue: 8,
          oldDate: '2026-10-16',
        },
        'Mathematics',
      ),
    ).toMatchObject({
      title: 'Grade date changed in Mathematics',
      body: 'The 8 is now dated 17 Oct 2026 (was 16 Oct 2026).',
    });
    expect(
      gradeMessage({ ...base, kind: 'deleted', value: 7 }, 'Mathematics'),
    ).toMatchObject({
      type: 'GRADE_REMOVED',
      body: 'The 7 from 17 Oct 2026 was removed.',
    });
  });

  it('alerts the homeroom teacher with the new average', () => {
    expect(lowGradeAlert('Ana Pop', 'Physics', 4, 5.33)).toMatchObject({
      type: 'HOMEROOM_ALERT',
      title: 'Ana Pop got a 4 in Physics',
      body: 'Their average in Physics is now 5.33.',
    });
    expect(lowAverageAlert('Ana Pop', 'Physics', 4.25).title).toBe(
      "Ana Pop's average in Physics dropped to 4.25",
    );
  });

  it('describes one timetable change, naming the class for teachers', () => {
    const moved: TimetableChange = {
      kind: 'moved',
      before: lesson(),
      after: lesson({ day: 'TUESDAY', period: 3 }),
    };
    expect(timetableMessage([moved], 'student')).toEqual({
      type: 'TIMETABLE_CHANGED',
      title: 'Mathematics moved',
      body: 'Monday, period 1 → Tuesday, period 3.',
    });
    expect(timetableMessage([moved], 'teacher').title).toBe(
      'Mathematics in 9A moved',
    );
  });

  it('lists several changes in one notification', () => {
    const changes: TimetableChange[] = [1, 2, 3, 4, 5].map((period) => ({
      kind: 'added',
      lesson: lesson({ period }),
    }));
    const message = timetableMessage(changes, 'student');
    expect(message.title).toBe('Your timetable changed (5 changes)');
    expect(message.body).toBe(
      'new: Mathematics, Monday, period 1; new: Mathematics, Monday, period 2; new: Mathematics, Monday, period 3; and 2 more.',
    );
  });

  it('tells teachers about their classes', () => {
    expect(
      assignmentMessage({
        kind: 'assigned',
        teacherUserId: 'u',
        classId: 'c',
        className: '9A',
        subjectName: 'Physics',
        hoursPerWeek: 2,
      }).title,
    ).toBe('You teach Physics in 9A');
    expect(
      assignmentMessage({
        kind: 'homeroom-assigned',
        teacherUserId: 'u',
        classId: 'c',
        className: '9A',
      }).title,
    ).toBe('You are the homeroom teacher of 9A');
  });
});
