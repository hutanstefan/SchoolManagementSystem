/** Grades are dated by the school's local calendar, not by the server's UTC clock. */
export const SCHOOL_TIME_ZONE = 'Europe/Bucharest';

/** Today's date in the school's time zone, as "YYYY-MM-DD". */
export function todayInSchool(now: Date = new Date()): string {
  // The sv-SE locale formats dates as YYYY-MM-DD.
  return now.toLocaleDateString('sv-SE', { timeZone: SCHOOL_TIME_ZONE });
}

/** Date-only column -> "YYYY-MM-DD". */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
