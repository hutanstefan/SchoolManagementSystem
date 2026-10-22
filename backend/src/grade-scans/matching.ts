import type { Confidence, RosterEntry } from './readers/test-reader';

/** "Ștefan-Andrei  Huțan" -> ["stefan", "andrei", "hutan"] */
export function nameTokens(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length >= 2);
}

/**
 * Whether a name read from a paper plausibly belongs to a student: at least one
 * name matches, or an initial matches ("Popescu I." for "Popescu Ioana").
 */
export function nameMatches(read: string, student: RosterEntry): boolean {
  const readTokens = nameTokens(read);
  const studentTokens = nameTokens(`${student.firstName} ${student.lastName}`);
  return readTokens.some((token) =>
    studentTokens.some((name) =>
      token.length >= 3 ? name === token : name.startsWith(token),
    ),
  );
}

/**
 * Finds the student a name refers to when the reader couldn't: every word of
 * the name must match the student's first or last name. Null unless exactly
 * one student fits.
 */
export function findStudentByName(
  read: string,
  roster: RosterEntry[],
): RosterEntry | null {
  const readTokens = nameTokens(read);
  if (readTokens.length === 0) return null;
  const matches = roster.filter((student) => {
    const studentTokens = nameTokens(
      `${student.firstName} ${student.lastName}`,
    );
    return readTokens.every((token) => studentTokens.includes(token));
  });
  return matches.length === 1 ? matches[0] : null;
}

/**
 * A grade read from a paper as a valid grade (whole number 1-10), rounded
 * like averages in Romanian schools: 9.50 -> 10, 9.49 -> 9.
 */
export function toWholeGrade(grade: number | null): number | null {
  if (grade === null || !Number.isFinite(grade)) return null;
  if (grade < 1 || grade > 10) return null;
  return Math.floor(grade + 0.5);
}

const ORDER: Confidence[] = ['low', 'medium', 'high'];

/** The lower of two confidence levels. */
export function lowerConfidence(a: Confidence, b: Confidence): Confidence {
  return ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))];
}
