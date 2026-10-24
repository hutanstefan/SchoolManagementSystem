import type { Prisma } from '../generated/prisma/client';

/** The two semesters of a school year. */
export type Semester = 1 | 2;
export const SEMESTERS: readonly Semester[] = [1, 2];

/** The last grade of high school: its students graduate. */
export const FINAL_GRADE_LEVEL = 12;

/** 2026 -> "2026–2027" */
export function yearName(startYear: number): string {
  return `${startYear}–${startYear + 1}`;
}

/** "10A" -> 10, "9 B" -> 9; null when the name doesn't start with a number. */
export function gradeLevel(className: string): number | null {
  const match = /^(\d{1,2})/.exec(className);
  return match ? Number(match[1]) : null;
}

/**
 * The class the students move up to: "9A" -> "10A". Null for the final grade
 * (they graduate). A name without a grade number keeps its name.
 */
export function nextClassName(className: string): string | null {
  const level = gradeLevel(className);
  if (level === null) return className;
  if (level >= FINAL_GRADE_LEVEL) return null;
  return `${level + 1}${className.slice(String(level).length)}`;
}

export const schoolYearSelect = {
  id: true,
  startYear: true,
  status: true,
  currentSemester: true,
  semester1EndedAt: true,
  closedAt: true,
} as const satisfies Prisma.SchoolYearSelect;

export type SchoolYearRow = Prisma.SchoolYearGetPayload<{
  select: typeof schoolYearSelect;
}>;
