import type { GradeScanResult, ScannedTest } from './api'

/** One photo in the review table, with the teacher's corrections. */
export interface ReviewRow {
  test: ScannedTest
  studentId: string | null
  grade: number | null
  include: boolean
}

export type RowProblem = 'failed' | 'no-student' | 'no-grade' | 'duplicate'

/** A row prefilled with what was read; unreadable or incomplete ones start unticked. */
export function toReviewRow(test: ScannedTest): ReviewRow {
  return {
    test,
    studentId: test.student?.id ?? null,
    grade: test.grade,
    include:
      test.status === 'read' && test.student !== null && test.grade !== null,
  }
}

export function toReviewRows(result: GradeScanResult): ReviewRow[] {
  return result.tests.map(toReviewRow)
}

/** Splits [0..n) into batches: [[0,1,2,3],[4,5,6,7],...]. */
export function batches<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

/** A result for a photo whose request failed as a whole (e.g. no connection). */
export function failedTest(
  index: number,
  fileName: string,
  error: string,
): ScannedTest {
  return {
    index,
    fileName,
    status: 'failed',
    error,
    student: null,
    studentNameRead: null,
    gradeRead: null,
    grade: null,
    confidence: 'low',
    note: null,
    readBy: null,
  }
}

/**
 * What blocks saving each included row. A student may appear only once:
 * two photos matched to the same student usually means one was misread.
 */
export function rowProblems(rows: ReviewRow[]): RowProblem[][] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.include && row.studentId) {
      counts.set(row.studentId, (counts.get(row.studentId) ?? 0) + 1)
    }
  }
  return rows.map((row) => {
    if (!row.include) return []
    const problems: RowProblem[] = []
    if (row.test.status === 'failed') problems.push('failed')
    if (!row.studentId) problems.push('no-student')
    else if ((counts.get(row.studentId) ?? 0) > 1) problems.push('duplicate')
    if (row.grade === null) problems.push('no-grade')
    return problems
  })
}

/** The grades to save, or null while something still needs fixing. */
export function gradesToSave(
  rows: ReviewRow[],
): { studentId: string; value: number }[] | null {
  const problems = rowProblems(rows)
  if (problems.some((p) => p.length > 0)) return null
  const grades = rows
    .filter((row) => row.include)
    .map((row) => ({ studentId: row.studentId!, value: row.grade! }))
  return grades.length > 0 ? grades : null
}
