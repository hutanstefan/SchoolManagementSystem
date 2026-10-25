import { crossing, defaultMaxAbsences, warningThreshold } from './limits';

describe('absence limits', () => {
  it('allow about a fifth of a semester of lessons', () => {
    expect(defaultMaxAbsences(1)).toBe(3);
    expect(defaultMaxAbsences(2)).toBe(7);
    expect(defaultMaxAbsences(4)).toBe(14);
  });

  it('warn from 80% of the limit', () => {
    expect(warningThreshold(14)).toBe(12);
    expect(warningThreshold(3)).toBe(3);
  });

  it('announce each step once', () => {
    expect(crossing(10, 11, 14)).toBeNull();
    expect(crossing(11, 12, 14)).toBe('warning');
    expect(crossing(12, 13, 14)).toBeNull();
    expect(crossing(14, 15, 14)).toBe('over');
    expect(crossing(15, 16, 14)).toBeNull();
    // Several at once (attendance taken late): the furthest step.
    expect(crossing(10, 16, 14)).toBe('over');
    // Excusing never announces anything; no limit, nothing to say.
    expect(crossing(15, 14, 14)).toBeNull();
    expect(crossing(0, 30, null)).toBeNull();
    expect(crossing(0, 1, 0)).toBe('over');
  });
});
