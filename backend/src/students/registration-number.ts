/**
 * Registration numbers (numere matricole): the year the student was enrolled
 * and their number among that year's enrollments, e.g. "2026-0042". Unique
 * in the school, readable, and sortable as text (by year, then number).
 */

const YEAR_FIRST = /^(\d{4})\s*[-/.]\s*(\d{1,4})$/;
/** How it's often written by hand in Romania: "42/2026". */
const YEAR_LAST = /^(\d{1,3})\s*\/\s*(\d{4})$/;

/** 2026, 42 -> "2026-0042" */
export function formatRegistrationNumber(year: number, number: number): string {
  return `${year}-${String(number).padStart(4, '0')}`;
}

/**
 * Reads a registration number as people write it: "2026-0042", "2026-42",
 * "2026/42" or "42/2026". Null when it isn't one.
 */
export function parseRegistrationNumber(text: string): string | null {
  const trimmed = text.trim();
  const first = YEAR_FIRST.exec(trimmed);
  const last = first ? null : YEAR_LAST.exec(trimmed);
  const [year, number] = first
    ? [Number(first[1]), Number(first[2])]
    : last
      ? [Number(last[2]), Number(last[1])]
      : [0, 0];
  return number === 0 ? null : formatRegistrationNumber(year, number);
}

/** The number after the highest one given in that year ("2026-0041" -> 42). */
export function nextNumberInYear(highest: string | null): number {
  return highest ? Number(highest.slice(5)) + 1 : 1;
}
