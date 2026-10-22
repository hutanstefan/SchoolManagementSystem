import {
  formatRegistrationNumber,
  nextNumberInYear,
  parseRegistrationNumber,
} from './registration-number';

describe('registration numbers', () => {
  it('are the year of enrollment and a number in that year', () => {
    expect(formatRegistrationNumber(2026, 42)).toBe('2026-0042');
    expect(formatRegistrationNumber(2023, 1)).toBe('2023-0001');
  });

  it('continue after the highest number of the year', () => {
    expect(nextNumberInYear(null)).toBe(1);
    expect(nextNumberInYear('2026-0041')).toBe(42);
  });

  it('are read as people write them', () => {
    expect(parseRegistrationNumber('2026-42')).toBe('2026-0042');
    expect(parseRegistrationNumber('2026 / 0042')).toBe('2026-0042');
    expect(parseRegistrationNumber('42/2026')).toBe('2026-0042');
    expect(parseRegistrationNumber('1042')).toBeNull();
    expect(parseRegistrationNumber('Popescu')).toBeNull();
  });

  it('sort by year, then number, as text', () => {
    const numbers = ['2026-0010', '2025-0002', '2026-0002'];
    expect([...numbers].sort()).toEqual([
      '2025-0002',
      '2026-0002',
      '2026-0010',
    ]);
  });
});
