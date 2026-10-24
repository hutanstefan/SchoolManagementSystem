import {
  averagesByStudent,
  distribution,
  mean,
  mondayOf,
  weeklyActivity,
} from './stats-math';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('stats math', () => {
  it('counts every grade from 1 to 10, zeros included', () => {
    const result = distribution([{ value: 10 }, { value: 10 }, { value: 4 }]);
    expect(result).toHaveLength(10);
    expect(result[9]).toEqual({ value: 10, count: 2 });
    expect(result[3]).toEqual({ value: 4, count: 1 });
    expect(result[0]).toEqual({ value: 1, count: 0 });
  });

  it("computes each student's subject averages the Romanian way", () => {
    const averages = averagesByStudent([
      { studentId: 's', subjectId: 'm', value: 9, date: d('2026-10-01') },
      { studentId: 's', subjectId: 'm', value: 10, date: d('2026-10-02') },
      { studentId: 's', subjectId: 'p', value: 4, date: d('2026-10-02') },
    ]);
    expect(averages.get('s')!.get('m')).toEqual({
      average: 9.5,
      roundedAverage: 10,
    });
    expect(averages.get('s')!.get('p')!.roundedAverage).toBe(4);
  });

  it('averages with two decimals', () => {
    expect(mean([7, 8, 8])).toBe(7.67);
    expect(mean([])).toBeNull();
  });

  it('groups grades by week (Monday to Sunday)', () => {
    expect(mondayOf(d('2026-10-22'))).toBe('2026-10-19'); // Thursday
    expect(mondayOf(d('2026-10-19'))).toBe('2026-10-19'); // Monday
    expect(mondayOf(d('2026-10-25'))).toBe('2026-10-19'); // Sunday

    const weeks = weeklyActivity(
      [
        { date: d('2026-10-20') },
        { date: d('2026-10-21') },
        { date: d('2026-10-13') },
        { date: d('2026-01-01') },
      ],
      d('2026-10-22'),
      3,
    );
    expect(weeks).toEqual([
      { weekStart: '2026-10-05', count: 0 },
      { weekStart: '2026-10-12', count: 1 },
      { weekStart: '2026-10-19', count: 2 },
    ]);
  });
});
