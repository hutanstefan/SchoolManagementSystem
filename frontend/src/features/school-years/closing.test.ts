import { describe, expect, it } from 'vitest'
import type { ClosingClass, ClosingStudent } from './api'
import {
  allowedOutcomes,
  canTakeReexams,
  countOutcomes,
  effectiveOutcome,
} from './closing'

const failed = (name: string) => ({
  subject: { id: name, name, color: 'INDIGO' as const, icon: 'BOOK' as const },
  semester1: 4,
  semester2: 4,
  annual: 4,
  reexamGrade: null,
  final: 4,
  passed: false,
})

const student = (
  id: string,
  suggestedOutcome: ClosingStudent['suggestedOutcome'],
  failedSubjects = 0,
): ClosingStudent => ({
  id,
  firstName: 'Ana',
  lastName: id,
  registrationNumber: `2026-${id}`,
  generalAverage: 7,
  failedSubjects: Array.from({ length: failedSubjects }, (_, i) =>
    failed(`s${i}`),
  ),
  suggestedOutcome,
})

const schoolClass = (
  nextClassName: string | null,
  students: ClosingStudent[],
): ClosingClass => ({
  class: { id: `c-${nextClassName}`, name: '9A' },
  nextClassName,
  students,
})

describe('closing the year', () => {
  it('lets the final grade graduate instead of moving up', () => {
    expect(allowedOutcomes(schoolClass('10A', []))).toEqual([
      'PROMOTED',
      'REPEATING',
    ])
    expect(allowedOutcomes(schoolClass(null, []))).toEqual([
      'GRADUATED',
      'REPEATING',
    ])
  })

  it('follows the suggestion unless the admin decided', () => {
    const decisions = new Map([['b', 'PROMOTED' as const]])
    expect(effectiveOutcome(student('a', 'PROMOTED'), decisions)).toBe(
      'PROMOTED',
    )
    expect(effectiveOutcome(student('b', 'REEXAM', 1), decisions)).toBe(
      'PROMOTED',
    )
    expect(effectiveOutcome(student('c', 'REEXAM', 1), decisions)).toBeNull()
  })

  it('takes re-exams for one or two failed subjects only', () => {
    expect(canTakeReexams(student('a', 'PROMOTED'))).toBe(false)
    expect(canTakeReexams(student('a', 'REEXAM', 2))).toBe(true)
    expect(canTakeReexams(student('a', 'REPEATING', 3))).toBe(false)
  })

  it('counts what will happen to everyone', () => {
    const classes = [
      schoolClass('10A', [
        student('a', 'PROMOTED'),
        student('b', 'REEXAM', 1),
        student('c', 'REPEATING', 3),
      ]),
      schoolClass(null, [student('d', 'GRADUATED')]),
    ]
    expect(countOutcomes(classes, new Map())).toEqual({
      promoted: 1,
      graduated: 1,
      repeating: 1,
      pending: 1,
    })
    expect(
      countOutcomes(classes, new Map([['b', 'REPEATING' as const]])),
    ).toMatchObject({ repeating: 2, pending: 0 })
  })
})
