import type { LessonSnapshot } from '../events/domain-events';
import { diffTimetable } from './timetable-diff';

const lesson = (
  id: string,
  overrides: Partial<LessonSnapshot> = {},
): LessonSnapshot => ({
  id,
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

describe('diffTimetable', () => {
  it('finds added, removed and moved lessons, in timetable order', () => {
    const before = [lesson('a'), lesson('b', { day: 'TUESDAY', period: 2 })];
    const after = [
      lesson('b', { day: 'FRIDAY', period: 3 }),
      lesson('c', { period: 4 }),
    ];

    expect(diffTimetable(before, after).map((c) => c.kind)).toEqual([
      'removed', // Monday 1
      'added', // Monday 4
      'moved', // now Friday 3
    ]);
  });

  it('sees a swap as two moves', () => {
    const before = [lesson('a'), lesson('b', { period: 2 })];
    const after = [lesson('a', { period: 2 }), lesson('b', { period: 1 })];
    expect(diffTimetable(before, after).map((c) => c.kind)).toEqual([
      'moved',
      'moved',
    ]);
  });

  it('tells a room change and a new teacher apart from a move', () => {
    const before = [lesson('a'), lesson('b', { period: 2 })];
    const after = [
      lesson('a', { room: 'Lab 2' }),
      lesson('b', { period: 2, teacherUserId: 'u-ana', teacherName: 'Ana' }),
    ];
    expect(diffTimetable(before, after).map((c) => c.kind)).toEqual([
      'room',
      'teacher',
    ]);
  });

  it('reports a new teacher once per subject, not once per lesson', () => {
    const before = [lesson('a'), lesson('b', { period: 2 })];
    const after = before.map((l) => ({ ...l, teacherUserId: 'u-ana' }));
    expect(diffTimetable(before, after)).toHaveLength(1);
  });

  it('finds nothing when nothing changed', () => {
    expect(diffTimetable([lesson('a')], [lesson('a')])).toEqual([]);
  });
});
