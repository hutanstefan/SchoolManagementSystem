/**
 * Averages computed the way Romanian schools do it:
 *
 * - Subject average: arithmetic mean of the grades with two decimals, truncated
 *   (not rounded), then rounded to a whole number. 9.50 becomes 10, 9.49 becomes 9.
 * - Overall average: mean of the rounded subject averages, with two decimals,
 *   truncated. It exists only when every subject has an average.
 * - Minimum number of grades in a subject: weekly hours + 1.
 * - Annual average of a subject: mean of its two (rounded) semester averages,
 *   with two exact decimals: 7 and 8 give 7.50. A re-exam grade replaces it.
 * - Annual general average: mean of the annual subject averages, two decimals,
 *   truncated.
 *
 * Integer arithmetic (hundredths) avoids floating point surprises such as 9.5 -> 9.4999.
 */

export interface SubjectAverage {
  /** Mean with two decimals, truncated, e.g. 8.66. */
  average: number | null;
  /** The average rounded to a whole grade, e.g. 9. */
  roundedAverage: number | null;
}

export function subjectAverage(values: number[]): SubjectAverage {
  if (values.length === 0) return { average: null, roundedAverage: null };

  const sum = values.reduce((total, value) => total + value, 0);
  const hundredths = Math.floor((sum * 100) / values.length);
  return {
    average: hundredths / 100,
    roundedAverage: Math.floor((hundredths + 50) / 100),
  };
}

/** Null if there are no subjects or a subject has no average yet. */
export function overallAverage(
  roundedSubjectAverages: (number | null)[],
): number | null {
  if (
    roundedSubjectAverages.length === 0 ||
    roundedSubjectAverages.some((value) => value === null)
  ) {
    return null;
  }
  const values = roundedSubjectAverages as number[];
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.floor((sum * 100) / values.length) / 100;
}

/** Null while a semester has no average (situație neîncheiată). */
export function annualSubjectAverage(
  semester1: number | null,
  semester2: number | null,
): number | null {
  if (semester1 === null || semester2 === null) return null;
  return ((semester1 + semester2) * 50) / 100;
}

/** Null if there are no subjects or one has no annual average. */
export function annualGeneralAverage(
  subjectAverages: (number | null)[],
): number | null {
  if (
    subjectAverages.length === 0 ||
    subjectAverages.some((value) => value === null)
  ) {
    return null;
  }
  const hundredths = (subjectAverages as number[]).reduce(
    (total, value) => total + Math.round(value * 100),
    0,
  );
  return Math.floor(hundredths / subjectAverages.length) / 100;
}

export function minimumGrades(hoursPerWeek: number): number {
  return hoursPerWeek + 1;
}
