/** Weeks of lessons in a semester, roughly. */
export const SEMESTER_WEEKS = 18;
/** The share of a semester's lessons a student may miss without an excuse. */
const ALLOWED_SHARE = 0.2;
/** A warning is sent from this share of the limit on. */
const WARNING_SHARE = 0.8;

/** The limit a subject gets by default: about a fifth of its lessons (4 h/week -> 14). */
export function defaultMaxAbsences(hoursPerWeek: number): number {
  return Math.floor(hoursPerWeek * SEMESTER_WEEKS * ALLOWED_SHARE);
}

/** From how many unexcused absences a student is warned (14 -> 12). */
export function warningThreshold(maxAbsences: number): number {
  return Math.ceil(maxAbsences * WARNING_SHARE);
}

export type LimitCrossing = 'warning' | 'over';

/**
 * What a student just reached, going from `before` to `after` unexcused
 * absences: the warning zone, over the limit, or nothing new (so each one is
 * announced once).
 */
export function crossing(
  before: number,
  after: number,
  maxAbsences: number | null,
): LimitCrossing | null {
  if (maxAbsences === null || after <= before) return null;
  if (before <= maxAbsences && after > maxAbsences) return 'over';
  const warning = warningThreshold(maxAbsences);
  if (
    maxAbsences > 0 &&
    before < warning &&
    after >= warning &&
    after <= maxAbsences
  ) {
    return 'warning';
  }
  return null;
}
