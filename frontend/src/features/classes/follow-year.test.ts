import { describe, expect, it } from 'vitest'
import { classInYear } from './follow-year'

const y2025 = { id: 'y-2025', name: '2025–2026', status: 'CLOSED' as const }
const y2026 = { id: 'y-2026', name: '2026–2027', status: 'ACTIVE' as const }
const tenA = {
  schoolYear: y2026,
  lineage: [
    { id: 'c-9a', name: '9A', schoolYear: y2025 },
    { id: 'c-10a', name: '10A', schoolYear: y2026 },
  ],
}

describe('classInYear', () => {
  it("stays when the class is the picked year's", () => {
    expect(classInYear(tenA, y2026)).toEqual({ status: 'same' })
    expect(classInYear(undefined, y2026)).toEqual({ status: 'same' })
  })

  it('moves to the same class in the picked year', () => {
    expect(classInYear(tenA, y2025)).toEqual({
      status: 'moved',
      classId: 'c-9a',
    })
  })

  it("says so when the class didn't exist that year", () => {
    const y2024 = { id: 'y-2024', name: '2024–2025' }
    expect(classInYear(tenA, y2024)).toEqual({
      status: 'missing',
      year: y2024,
    })
  })
})
