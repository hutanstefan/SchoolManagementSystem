import { gradeLevel, nextClassName, yearName } from './school-year';

describe('school years and class names', () => {
  it('names a school year by its two calendar years', () => {
    expect(yearName(2026)).toBe('2026–2027');
  });

  it('reads the grade level from the class name', () => {
    expect(gradeLevel('9A')).toBe(9);
    expect(gradeLevel('10B')).toBe(10);
    expect(gradeLevel('12 Mate-Info')).toBe(12);
    expect(gradeLevel('E2E-123')).toBeNull();
  });

  it('moves a class up a grade, and graduates the 12th', () => {
    expect(nextClassName('9A')).toBe('10A');
    expect(nextClassName('11 Real')).toBe('12 Real');
    expect(nextClassName('12A')).toBeNull();
    expect(nextClassName('PREP')).toBe('PREP');
  });
});
