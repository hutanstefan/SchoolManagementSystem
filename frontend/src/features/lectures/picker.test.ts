import { describe, expect, it } from 'vitest'
import type { LectureStudent } from './api'
import { groupByClass, groupState, matchesSearch, toggleMany } from './picker'

const student = (
  id: string,
  name: string,
  className: string | null,
): LectureStudent => ({
  id,
  firstName: name,
  lastName: 'Popescu',
  registrationNumber: `2026-00${id}`,
  class: className ? { id: `c-${className}`, name: className } : null,
})

const students = [
  student('1', 'Ana', '9A'),
  student('2', 'Ștefan', '9A'),
  student('3', 'Ioana', '11A'),
  student('4', 'Radu', null),
]

describe('student picker', () => {
  it('groups the students by class, the ones without a class last', () => {
    expect(
      groupByClass(students).map((g) => [g.name, g.students.length]),
    ).toEqual([
      ['Class 9A', 2],
      ['Class 11A', 1],
      ['Not in a class', 1],
    ])
  })

  it('finds students by name without diacritics, reg. no. or class', () => {
    expect(students.filter((s) => matchesSearch(s, 'stefan'))).toHaveLength(1)
    expect(students.filter((s) => matchesSearch(s, '11a'))).toHaveLength(1)
    expect(students.filter((s) => matchesSearch(s, '2026-004'))).toHaveLength(1)
    expect(students.filter((s) => matchesSearch(s, 'popescu 9a'))).toHaveLength(
      2,
    )
  })

  it('selects a whole class at once and shows a half-ticked class', () => {
    const nineA = groupByClass(students)[0]!.students
    let selected = toggleMany(new Set(), ['1'], true)
    expect(groupState(nineA, selected)).toBe('indeterminate')
    selected = toggleMany(
      selected,
      nineA.map((s) => s.id),
      true,
    )
    expect(groupState(nineA, selected)).toBe(true)
    selected = toggleMany(
      selected,
      nineA.map((s) => s.id),
      false,
    )
    expect(groupState(nineA, selected)).toBe(false)
  })
})
