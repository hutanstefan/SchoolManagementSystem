import { describe, expect, it } from 'vitest'
import type { SchoolClass } from '@/features/classes/api'
import type { TeacherDetail } from '@/features/teachers/api'
import { groupTeaching } from './teaching'

const c9A = { id: 'c-9a', name: '9A' }
const c10A = { id: 'c-10a', name: '10A' }
const c11B = { id: 'c-11b', name: '11B' }
const maths = { id: 's-maths', name: 'Mathematics', color: 'INDIGO' as const }
const physics = { id: 's-physics', name: 'Physics', color: 'VIOLET' as const }

const profile = {
  id: 't-1',
  userId: 'u-1',
  email: 'teacher@school.test',
  firstName: 'Ana',
  lastName: 'Pop',
  createdAt: '2026-01-01T00:00:00.000Z',
  homeroomClasses: [c11B, c9A],
  teaching: [
    { classSubjectId: 'cs-1', class: c10A, subject: maths, hoursPerWeek: 4 },
    { classSubjectId: 'cs-2', class: c9A, subject: maths, hoursPerWeek: 4 },
    { classSubjectId: 'cs-3', class: c9A, subject: physics, hoursPerWeek: 2 },
  ],
} satisfies TeacherDetail

describe('groupTeaching', () => {
  it('groups subjects by class, in natural class order', () => {
    const result = groupTeaching(profile)

    expect(result.map((c) => c.name)).toEqual(['9A', '10A', '11B'])
    expect(result[0]!.subjects.map((s) => s.name)).toEqual([
      'Mathematics',
      'Physics',
    ])
  })

  it('marks homeroom classes, even where the teacher teaches nothing', () => {
    const result = groupTeaching(profile)

    expect(result.find((c) => c.name === '9A')!.isHomeroom).toBe(true)
    expect(result.find((c) => c.name === '10A')!.isHomeroom).toBe(false)
    expect(result.find((c) => c.name === '11B')).toMatchObject({
      isHomeroom: true,
      subjects: [],
    })
  })

  it('adds student counts from the class list when available', () => {
    const classes = [
      {
        ...c9A,
        gradeLevel: 9,
        schoolYear: { id: 'y', name: '2026–2027', status: 'ACTIVE' as const },
        studentCount: 28,
        homeroomTeacher: null,
        createdAt: '',
      },
    ] satisfies SchoolClass[]

    const result = groupTeaching(profile, classes)

    expect(result.find((c) => c.name === '9A')!.studentCount).toBe(28)
    expect(result.find((c) => c.name === '10A')!.studentCount).toBeNull()
  })
})
