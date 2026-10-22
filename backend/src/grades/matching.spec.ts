import {
  findStudentByName,
  lowerConfidence,
  nameMatches,
  nameTokens,
  toWholeGrade,
} from './matching';

const roster = [
  { number: 1, firstName: 'Ioana', lastName: 'Popescu' },
  { number: 2, firstName: 'Ștefan', lastName: 'Huțan' },
  { number: 3, firstName: 'Andrei', lastName: 'Popescu' },
];

describe('matching names and grades read from tests', () => {
  it('ignores case, diacritics and punctuation in names', () => {
    expect(nameTokens('  ȘTEFAN-Andrei  Huțan.')).toEqual([
      'stefan',
      'andrei',
      'hutan',
    ]);
  });

  it('accepts a name written in any order, with initials or without diacritics', () => {
    expect(nameMatches('Hutan Stefan', roster[1])).toBe(true);
    expect(nameMatches('Popescu I.', roster[0])).toBe(true);
    expect(nameMatches('Ionescu Maria', roster[0])).toBe(false);
  });

  it('finds a student by name only when exactly one fits', () => {
    expect(findStudentByName('Stefan Hutan', roster)?.number).toBe(2);
    expect(findStudentByName('Andrei Popescu', roster)?.number).toBe(3);
    // Two students are called Popescu.
    expect(findStudentByName('Popescu', roster)).toBeNull();
    expect(findStudentByName('Maria', roster)).toBeNull();
    expect(findStudentByName('', roster)).toBeNull();
  });

  it('rounds grades like Romanian averages and rejects invalid ones', () => {
    expect(toWholeGrade(9)).toBe(9);
    expect(toWholeGrade(9.5)).toBe(10);
    expect(toWholeGrade(9.49)).toBe(9);
    expect(toWholeGrade(1)).toBe(1);
    expect(toWholeGrade(0)).toBeNull();
    expect(toWholeGrade(10.5)).toBeNull();
    expect(toWholeGrade(null)).toBeNull();
    expect(toWholeGrade(Number.NaN)).toBeNull();
  });

  it('keeps the lower of two confidence levels', () => {
    expect(lowerConfidence('high', 'medium')).toBe('medium');
    expect(lowerConfidence('low', 'high')).toBe('low');
  });
});
