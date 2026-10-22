import type { Schemas } from '@/api/client'
import type { GradeEntry } from '../api'

/**
 * Reviewing grades before they are saved, whatever they come from (photos of
 * tests read by AI, or rows of a spreadsheet). Pure functions, unit-tested.
 */

/** What to do when the student already has a grade in the subject that day. */
export type Decision = { kind: 'add' } | { kind: 'replace'; gradeId: string }

export interface ReviewRow<S> {
  key: string
  /** Where the row comes from (a scanned photo, a spreadsheet row...). */
  source: S
  /** Nothing could be read (e.g. the AI failed on this photo). */
  failed: boolean
  studentId: string | null
  grade: number | null
  /** Its own date (from a spreadsheet), or null for the date of the batch. */
  date: string | null
  include: boolean
  decision: Decision | null
}

export interface ReviewContext {
  /** The date chosen on the page, for rows without their own. */
  batchDate: string
  /** The grades a student already has in the subject (from the gradebook). */
  gradesOf: (studentId: string) => GradeEntry[]
}

export type RowProblem =
  'failed' | 'no-student' | 'no-grade' | 'duplicate' | 'same-day'

export function effectiveDate(
  row: ReviewRow<unknown>,
  context: ReviewContext,
): string {
  return row.date ?? context.batchDate
}

/** Grades the row's student already has on the row's date. */
export function sameDayGrades(
  row: ReviewRow<unknown>,
  context: ReviewContext,
): GradeEntry[] {
  if (!row.studentId) return []
  const date = effectiveDate(row, context)
  return context
    .gradesOf(row.studentId)
    .filter((grade) => grade.date.slice(0, 10) === date)
}

/**
 * What blocks saving each included row. A student may appear only once (two
 * rows for the same student usually means one was misread), and a grade the
 * student already has that day needs a decision: add another one or replace it.
 */
export function rowProblems(
  rows: ReviewRow<unknown>[],
  context: ReviewContext,
): RowProblem[][] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.include && row.studentId) {
      counts.set(row.studentId, (counts.get(row.studentId) ?? 0) + 1)
    }
  }
  return rows.map((row) => {
    if (!row.include) return []
    const problems: RowProblem[] = []
    if (row.failed) problems.push('failed')
    if (!row.studentId) problems.push('no-student')
    else if ((counts.get(row.studentId) ?? 0) > 1) problems.push('duplicate')
    if (row.grade === null) problems.push('no-grade')
    if (row.decision === null && sameDayGrades(row, context).length > 0) {
      problems.push('same-day')
    }
    return problems
  })
}

/** The grades to send to POST /classes/:id/grades, or null while something needs fixing. */
export function gradesToSave(
  rows: ReviewRow<unknown>[],
  context: ReviewContext,
): Schemas['BatchGradeDto'][] | null {
  const problems = rowProblems(rows, context)
  if (problems.some((p) => p.length > 0)) return null
  const grades = rows
    .filter((row) => row.include)
    .map((row) => ({
      studentId: row.studentId!,
      value: row.grade!,
      ...(row.date ? { date: row.date } : {}),
      ...(row.decision?.kind === 'replace'
        ? { replaceGradeId: row.decision.gradeId }
        : {}),
    }))
  return grades.length > 0 ? grades : null
}

/** Splits items into batches: [[0,1,2,3],[4,5,6,7],...]. */
export function batches<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}
