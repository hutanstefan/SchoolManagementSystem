import {
  annualGeneralAverage,
  annualSubjectAverage,
  subjectAverage,
} from '../grades/averages';

/** A subject passes with an annual average (or re-exam grade) of at least 5. */
export const PASSING_AVERAGE = 5;
/** With more failed subjects than this, there is no re-exam: the year is repeated. */
export const MAX_REEXAMS = 2;

/**
 * What the rules say should happen to a student. REEXAM: one or two subjects
 * failed and their re-exam results aren't in yet.
 */
export type SuggestedOutcome =
  'PROMOTED' | 'GRADUATED' | 'REPEATING' | 'REEXAM';

export interface SubjectGradesOfYear {
  subjectId: string;
  semester1: number[];
  semester2: number[];
  reexamGrade: number | null;
}

export interface SubjectYearResult {
  subjectId: string;
  /** Rounded semester averages. */
  semester1: number | null;
  semester2: number | null;
  annual: number | null;
  reexamGrade: number | null;
  /** The re-exam grade if there is one, else the annual average. */
  final: number | null;
  passed: boolean;
}

export interface YearResult {
  subjects: SubjectYearResult[];
  generalAverage: number | null;
  /** Subjects failed on the annual average (or without one). */
  failedSubjects: SubjectYearResult[];
  suggestedOutcome: SuggestedOutcome;
}

/**
 * A student's year, by the Romanian rules: every subject passed -> promoted
 * (graduated after the final grade); one or two failed -> re-exams, each
 * must be passed; three or more -> the year is repeated.
 */
export function yearResult(
  subjects: SubjectGradesOfYear[],
  finalGrade: boolean,
): YearResult {
  const results = subjects.map((s): SubjectYearResult => {
    const semester1 = subjectAverage(s.semester1).roundedAverage;
    const semester2 = subjectAverage(s.semester2).roundedAverage;
    const annual = annualSubjectAverage(semester1, semester2);
    const final = s.reexamGrade ?? annual;
    return {
      subjectId: s.subjectId,
      semester1,
      semester2,
      annual,
      reexamGrade: s.reexamGrade,
      final,
      passed: final !== null && final >= PASSING_AVERAGE,
    };
  });

  const failedSubjects = results.filter(
    (r) => r.annual === null || r.annual < PASSING_AVERAGE,
  );
  const passedAll = finalGrade ? 'GRADUATED' : 'PROMOTED';
  let suggestedOutcome: SuggestedOutcome;
  if (failedSubjects.length === 0) {
    suggestedOutcome = passedAll;
  } else if (failedSubjects.length > MAX_REEXAMS) {
    suggestedOutcome = 'REPEATING';
  } else if (failedSubjects.some((r) => r.reexamGrade === null)) {
    suggestedOutcome = 'REEXAM';
  } else {
    suggestedOutcome = failedSubjects.every((r) => r.passed)
      ? passedAll
      : 'REPEATING';
  }

  return {
    subjects: results,
    generalAverage: annualGeneralAverage(results.map((r) => r.final)),
    failedSubjects,
    suggestedOutcome,
  };
}
