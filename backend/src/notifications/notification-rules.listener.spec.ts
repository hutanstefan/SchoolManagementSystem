import type { GradeChange } from '../events/domain-events';
import { valuesBefore } from './notification-rules.listener';

describe('valuesBefore', () => {
  const change = (c: Partial<GradeChange>): GradeChange => ({
    kind: 'created',
    gradeId: 'g',
    studentId: 's',
    value: 0,
    date: '2026-10-17',
    ...c,
  });

  it('undoes created, updated and deleted grades', () => {
    const now = [
      { id: 'g1', value: 9 },
      { id: 'g2', value: 3 }, // just given
      { id: 'g3', value: 4 }, // was a 7
    ];
    const changes = [
      change({ kind: 'created', gradeId: 'g2', value: 3 }),
      change({ kind: 'updated', gradeId: 'g3', value: 4, oldValue: 7 }),
      change({ kind: 'deleted', gradeId: 'g4', value: 10 }),
    ];
    expect(valuesBefore(now, changes).sort()).toEqual([10, 7, 9].sort());
  });
});
