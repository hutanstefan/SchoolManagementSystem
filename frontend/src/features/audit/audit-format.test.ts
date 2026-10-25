import { describe, expect, it } from 'vitest'
import { browserOf, fieldLabel, formatValue, modelLabel } from './audit-format'

describe('activity log formatting', () => {
  it('names fields the way people say them', () => {
    expect(fieldLabel('user.firstName')).toBe('first name')
    expect(fieldLabel('subjectId')).toBe('subject')
    expect(fieldLabel('homeroomTeacherId')).toBe('homeroom teacher')
    expect(fieldLabel('hoursPerWeek')).toBe('hours per week')
    expect(fieldLabel('passwordHash')).toBe('password')
  })

  it('shows names instead of ids, and readable dates', () => {
    const names = { 's-1': 'Andrei Georgescu' }
    expect(formatValue('s-1', names)).toBe('Andrei Georgescu')
    expect(formatValue(null, names)).toBe('—')
    expect(formatValue(true, names)).toBe('yes')
    expect(formatValue(9, names)).toBe('9')
    expect(formatValue('2026-10-14T00:00:00.000Z', names)).toBe('14 Oct 2026')
  })

  it('names records and browsers', () => {
    expect(modelLabel('TimetableEntry')).toBe('Lesson')
    expect(modelLabel('Grade')).toBe('Grade')
    expect(
      browserOf(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      ),
    ).toBe('Chrome on Windows')
    expect(browserOf(null)).toBeNull()
  })
})
