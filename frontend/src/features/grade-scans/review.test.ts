import { describe, expect, it } from 'vitest'
import type { GradeScanResult, ScannedTest } from './api'
import {
  batches,
  gradesToSave,
  rowProblems,
  toReviewRows,
  type ReviewRow,
} from './review'

const test = (overrides: Partial<ScannedTest> = {}): ScannedTest => ({
  index: 0,
  fileName: 'test.jpg',
  status: 'read',
  error: null,
  student: { id: 'st-1', firstName: 'Ioana', lastName: 'Popescu' },
  studentNameRead: 'Popescu Ioana',
  gradeRead: 9,
  grade: 9,
  confidence: 'high',
  note: null,
  readBy: 'gemini-3.8-flash',
  ...overrides,
})

const result = (tests: ScannedTest[]): GradeScanResult => ({
  mode: 'ai',
  model: 'claude-haiku-5-5',
  class: { id: 'c-1', name: '9A' },
  subject: { id: 's-1', name: 'Mathematics' },
  tests,
})

const row = (overrides: Partial<ReviewRow> = {}): ReviewRow => ({
  test: test(),
  studentId: 'st-1',
  grade: 9,
  include: true,
  ...overrides,
})

describe('reviewing scanned tests', () => {
  it('ticks only the photos that were read completely', () => {
    const rows = toReviewRows(
      result([
        test(),
        test({ student: null }),
        test({ grade: null }),
        test({ status: 'failed', student: null, grade: null }),
      ]),
    )
    expect(rows.map((r) => r.include)).toEqual([true, false, false, false])
  })

  it('flags the same student on two included photos', () => {
    const problems = rowProblems([
      row(),
      row({ test: test({ index: 1 }) }),
      row({ studentId: 'st-2' }),
    ])
    expect(problems).toEqual([['duplicate'], ['duplicate'], []])
  })

  it('ignores rows that are not included', () => {
    expect(rowProblems([row(), row({ include: false })])).toEqual([[], []])
  })

  it('needs a student and a grade on every included row', () => {
    expect(rowProblems([row({ studentId: null, grade: null })])).toEqual([
      ['no-student', 'no-grade'],
    ])
  })

  it('returns the grades to save only when nothing needs fixing', () => {
    expect(
      gradesToSave([
        row(),
        row({ studentId: 'st-2', grade: 7 }),
        row({ include: false }),
      ]),
    ).toEqual([
      { studentId: 'st-1', value: 9 },
      { studentId: 'st-2', value: 7 },
    ])
    expect(gradesToSave([row(), row()])).toBeNull()
    expect(gradesToSave([row({ include: false })])).toBeNull()
  })
})

describe('batches', () => {
  it('splits photos into requests of a few photos each', () => {
    expect(batches([0, 1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8],
    ])
    expect(batches([], 4)).toEqual([])
  })
})
