import type { ClosingClass, ClosingStudent, YearOutcome } from './api'

/** At most this many failed subjects can be retaken at a re-exam. */
export const MAX_REEXAMS = 2

export type Decisions = ReadonlyMap<string, YearOutcome>

/** Outcomes possible for a class: the final grade graduates instead. */
export function allowedOutcomes(schoolClass: ClosingClass): YearOutcome[] {
  return schoolClass.nextClassName === null
    ? ['GRADUATED', 'REPEATING']
    : ['PROMOTED', 'REPEATING']
}

/**
 * What happens to a student: the admin's decision, else the suggestion;
 * null while re-exam results are missing.
 */
export function effectiveOutcome(
  student: ClosingStudent,
  decisions: Decisions,
): YearOutcome | null {
  const decided = decisions.get(student.id)
  if (decided) return decided
  return student.suggestedOutcome === 'REEXAM' ? null : student.suggestedOutcome
}

/** Whether re-exam grades can be entered: one or two failed subjects. */
export function canTakeReexams(student: ClosingStudent): boolean {
  return (
    student.failedSubjects.length > 0 &&
    student.failedSubjects.length <= MAX_REEXAMS
  )
}

export interface ClosingCounts {
  promoted: number
  graduated: number
  repeating: number
  /** Waiting for re-exam grades or a decision. */
  pending: number
}

export function countOutcomes(
  classes: ClosingClass[],
  decisions: Decisions,
): ClosingCounts {
  const counts: ClosingCounts = {
    promoted: 0,
    graduated: 0,
    repeating: 0,
    pending: 0,
  }
  for (const c of classes) {
    for (const student of c.students) {
      const outcome = effectiveOutcome(student, decisions)
      if (outcome === 'PROMOTED') counts.promoted++
      else if (outcome === 'GRADUATED') counts.graduated++
      else if (outcome === 'REPEATING') counts.repeating++
      else counts.pending++
    }
  }
  return counts
}

/** Students the admin should look at: failed subjects or no outcome yet. */
export function needsAttention(
  student: ClosingStudent,
  decisions: Decisions,
): boolean {
  return (
    student.failedSubjects.length > 0 ||
    effectiveOutcome(student, decisions) !== student.suggestedOutcome
  )
}
