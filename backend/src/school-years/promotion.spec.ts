import { annualGeneralAverage, annualSubjectAverage } from '../grades/averages';
import { yearResult, type SubjectGradesOfYear } from './promotion';

const subject = (
  subjectId: string,
  semester1: number[],
  semester2: number[],
  reexamGrade: number | null = null,
): SubjectGradesOfYear => ({ subjectId, semester1, semester2, reexamGrade });

describe('annual averages', () => {
  it('is the mean of the two rounded semester averages, with exact decimals', () => {
    expect(annualSubjectAverage(7, 8)).toBe(7.5);
    expect(annualSubjectAverage(4, 5)).toBe(4.5);
    expect(annualSubjectAverage(9, null)).toBeNull();
  });

  it('gives the general average only when every subject has one', () => {
    expect(annualGeneralAverage([7.5, 9, 8])).toBe(8.16);
    expect(annualGeneralAverage([7.5, null])).toBeNull();
  });
});

describe('yearResult', () => {
  it('promotes a student who passed every subject', () => {
    const result = yearResult(
      [subject('maths', [8, 9], [7, 7]), subject('physics', [10], [9, 9])],
      false,
    );
    // Maths: semester averages 9 (8.50 rounded) and 7 -> 8; physics: 10 and 9 -> 9.50.
    expect(result.subjects.map((s) => s.annual)).toEqual([8, 9.5]);
    expect(result.generalAverage).toBe(8.75);
    expect(result.suggestedOutcome).toBe('PROMOTED');
  });

  it('graduates a student of the final grade', () => {
    expect(
      yearResult([subject('maths', [8], [8])], true).suggestedOutcome,
    ).toBe('GRADUATED');
  });

  it('asks for re-exams for one or two failed subjects', () => {
    const result = yearResult(
      [subject('maths', [4, 4], [5, 4]), subject('physics', [8], [8])],
      false,
    );
    // Maths: 4 and 4.50 -> 5, annual 4.50.
    expect(result.failedSubjects.map((s) => s.subjectId)).toEqual(['maths']);
    expect(result.suggestedOutcome).toBe('REEXAM');
  });

  it('promotes after passed re-exams, holds back after a failed one', () => {
    const passed = yearResult([subject('maths', [3], [4], 6)], false);
    expect(passed.suggestedOutcome).toBe('PROMOTED');
    expect(passed.subjects[0].final).toBe(6);

    const failed = yearResult(
      [subject('maths', [3], [4], 6), subject('physics', [3], [3], 4)],
      false,
    );
    expect(failed.suggestedOutcome).toBe('REPEATING');
  });

  it('holds back a student with three failed subjects, re-exams or not', () => {
    const result = yearResult(
      [subject('a', [4], [4]), subject('b', [3], [4]), subject('c', [2], [4])],
      false,
    );
    expect(result.suggestedOutcome).toBe('REPEATING');
  });

  it('counts a subject without grades in a semester as not passed', () => {
    const result = yearResult([subject('maths', [9], [])], false);
    expect(result.subjects[0].annual).toBeNull();
    expect(result.suggestedOutcome).toBe('REEXAM');
  });
});
