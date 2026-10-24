import { subjectAverage } from '../grades/averages';
import type { GradeCountDto, WeekActivityDto } from './dto/stats.dto';

/** The passing mark: an average under it puts a student at risk. */
export const PASSING_GRADE = 5;

export interface GradeRow {
  studentId: string;
  subjectId: string;
  value: number;
  date: Date;
}

/** Grades 1-10 with their counts (zero included, so the chart has every bar). */
export function distribution(grades: { value: number }[]): GradeCountDto[] {
  const counts = new Array<number>(11).fill(0);
  for (const grade of grades) counts[grade.value]++;
  return counts.slice(1).map((count, i) => ({ value: i + 1, count }));
}

/** Each student's average per subject: studentId -> subjectId -> average. */
export function averagesByStudent(
  grades: GradeRow[],
): Map<string, Map<string, ReturnType<typeof subjectAverage>>> {
  const values = new Map<string, Map<string, number[]>>();
  for (const g of grades) {
    const bySubject = values.get(g.studentId) ?? new Map<string, number[]>();
    bySubject.set(g.subjectId, [
      ...(bySubject.get(g.subjectId) ?? []),
      g.value,
    ]);
    values.set(g.studentId, bySubject);
  }
  return new Map(
    [...values].map(([studentId, bySubject]) => [
      studentId,
      new Map(
        [...bySubject].map(([subjectId, list]) => [
          subjectId,
          subjectAverage(list),
        ]),
      ),
    ]),
  );
}

/** Mean with two decimals, or null for nothing. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, v) => total + v, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

/** "2026-10-22" -> "2026-10-19" (the Monday of its week). */
export function mondayOf(date: Date): string {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const shift = (day.getUTCDay() + 6) % 7; // Monday = 0
  day.setUTCDate(day.getUTCDate() - shift);
  return day.toISOString().slice(0, 10);
}

/** Grades per week for the last `weeks` weeks up to `today`, oldest first. */
export function weeklyActivity(
  grades: { date: Date }[],
  today: Date,
  weeks = 8,
): WeekActivityDto[] {
  const thisWeek = new Date(`${mondayOf(today)}T00:00:00Z`);
  const starts = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(thisWeek);
    d.setUTCDate(d.getUTCDate() - 7 * (weeks - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const counts = new Map(starts.map((start) => [start, 0]));
  for (const grade of grades) {
    const week = mondayOf(grade.date);
    if (counts.has(week)) counts.set(week, counts.get(week)! + 1);
  }
  return starts.map((weekStart) => ({
    weekStart,
    count: counts.get(weekStart)!,
  }));
}
