import type { ReviewRow } from '@/features/grades/review/review'
import type { ImportedGradeRow } from './api'

export type ImportRow = ReviewRow<ImportedGradeRow>

/** A row prefilled from the file; rows with something missing start unticked. */
export function toImportRow(row: ImportedGradeRow): ImportRow {
  return {
    key: String(row.rowNumber),
    source: row,
    failed: false,
    studentId: row.student?.id ?? null,
    grade: row.grade,
    date: row.date,
    include: row.student !== null && row.grade !== null,
    decision: null,
  }
}
