import { describe, expect, it } from 'vitest'
import { absenceStatus, defaultMaxAbsences } from './limits'

describe('absence limits', () => {
  it('defaults to a fifth of the lessons of a semester', () => {
    expect(defaultMaxAbsences(4)).toBe(14)
    expect(defaultMaxAbsences(2)).toBe(7)
    expect(defaultMaxAbsences(1)).toBe(3)
  })

  it('is close from 80% of the limit, over above it', () => {
    expect(absenceStatus(11, 14)).toBe('ok')
    expect(absenceStatus(12, 14)).toBe('near')
    expect(absenceStatus(14, 14)).toBe('near')
    expect(absenceStatus(15, 14)).toBe('over')
    expect(absenceStatus(1, 0)).toBe('over')
    expect(absenceStatus(0, 0)).toBe('ok')
    expect(absenceStatus(40, null)).toBe('ok')
  })
})
