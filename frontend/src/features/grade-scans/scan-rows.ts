import type { ReviewRow } from '@/features/grades/review/review'
import type { ScannedTest } from './api'

export type ScanRow = ReviewRow<ScannedTest>

/** A row prefilled with what was read; unreadable or incomplete ones start unticked. */
export function toScanRow(test: ScannedTest): ScanRow {
  return {
    key: String(test.index),
    source: test,
    failed: test.status === 'failed',
    studentId: test.student?.id ?? null,
    grade: test.grade,
    date: null,
    include:
      test.status === 'read' && test.student !== null && test.grade !== null,
    decision: null,
  }
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
