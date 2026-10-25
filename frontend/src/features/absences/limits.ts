import type { AbsenceCount } from './api'

/** Same rules as the API (backend/src/absences/limits.ts). */
const SEMESTER_WEEKS = 18
const ALLOWED_SHARE = 0.2
const WARNING_SHARE = 0.8

/** The limit a subject gets by default: about a fifth of its lessons (4 h/week -> 14). */
export function defaultMaxAbsences(hoursPerWeek: number): number {
  return Math.floor(hoursPerWeek * SEMESTER_WEEKS * ALLOWED_SHARE)
}

export type AbsenceStatus = 'over' | 'near' | 'ok'

/** Over the limit, close to it (80% or more), or fine. No limit: always fine. */
export function absenceStatus(
  unexcused: number,
  maxAbsences: number | null,
): AbsenceStatus {
  if (maxAbsences === null) return 'ok'
  if (unexcused > maxAbsences) return 'over'
  if (maxAbsences > 0 && unexcused >= Math.ceil(maxAbsences * WARNING_SHARE)) {
    return 'near'
  }
  return 'ok'
}

/** e.g. "12 unexcused of 14 allowed · 1 excused" */
export function absenceSummary(
  count: AbsenceCount,
  maxAbsences: number | null,
): string {
  const unexcused =
    maxAbsences === null
      ? `${count.unexcused} unexcused`
      : `${count.unexcused} unexcused of ${maxAbsences} allowed`
  return `${unexcused} · ${count.excused} excused`
}
