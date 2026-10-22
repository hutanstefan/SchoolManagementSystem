import { describe, expect, it } from 'vitest'
import type { GradeEntry } from '../api'
import {
  batches,
  gradesToSave,
  rowProblems,
  sameDayGrades,
  type ReviewContext,
  type ReviewRow,
} from './review'

const row = (overrides: Partial<ReviewRow<null>> = {}): ReviewRow<null> => ({
  key: 'r',
  source: null,
  failed: false,
  studentId: 'st-1',
  grade: 9,
  date: null,
  include: true,
  decision: null,
  ...overrides,
})

const grade = (id: string, date: string, value = 7): GradeEntry => ({
  id,
  value,
  date,
  teacher: { id: 't-1', firstName: 'Mihai', lastName: 'Ionescu' },
})

const context = (grades: Record<string, GradeEntry[]> = {}): ReviewContext => ({
  batchDate: '2026-10-22',
  gradesOf: (studentId) => grades[studentId] ?? [],
})

describe('reviewing grades before saving', () => {
  it('flags the same student on two included rows', () => {
    expect(
      rowProblems(
        [row(), row({ key: 'b' }), row({ studentId: 'st-2' })],
        context(),
      ),
    ).toEqual([['duplicate'], ['duplicate'], []])
  })

  it('ignores rows that are not included', () => {
    expect(rowProblems([row(), row({ include: false })], context())).toEqual([
      [],
      [],
    ])
  })

  it('needs a student and a grade, and flags rows that could not be read', () => {
    expect(
      rowProblems(
        [row({ studentId: null, grade: null, failed: true })],
        context(),
      ),
    ).toEqual([['failed', 'no-student', 'no-grade']])
  })

  it('asks for a decision when the student already has a grade that day', () => {
    const ctx = context({
      'st-1': [grade('g-old', '2026-10-01'), grade('g-today', '2026-10-22')],
    })

    expect(sameDayGrades(row(), ctx).map((g) => g.id)).toEqual(['g-today'])
    expect(rowProblems([row()], ctx)).toEqual([['same-day']])
    // A row with its own date (from a spreadsheet) is compared on that date.
    expect(rowProblems([row({ date: '2026-10-05' })], ctx)).toEqual([[]])
    expect(rowProblems([row({ decision: { kind: 'add' } })], ctx)).toEqual([[]])
  })

  it('sends dates and replacements only when there are some', () => {
    expect(
      gradesToSave(
        [
          row(),
          row({ studentId: 'st-2', grade: 7, date: '2026-10-05' }),
          row({
            studentId: 'st-3',
            grade: 10,
            decision: { kind: 'replace', gradeId: 'g-3' },
          }),
          row({ studentId: 'st-4', include: false }),
        ],
        context(),
      ),
    ).toEqual([
      { studentId: 'st-1', value: 9 },
      { studentId: 'st-2', value: 7, date: '2026-10-05' },
      { studentId: 'st-3', value: 10, replaceGradeId: 'g-3' },
    ])
  })

  it('returns nothing to save while a problem remains or nothing is selected', () => {
    expect(gradesToSave([row(), row()], context())).toBeNull()
    expect(gradesToSave([row({ include: false })], context())).toBeNull()
  })
})

describe('batches', () => {
  it('splits items into groups of a few', () => {
    expect(batches([0, 1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8],
    ])
    expect(batches([], 4)).toEqual([])
  })
})
