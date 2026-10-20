import { describe, expect, it } from 'vitest'
import {
  formatAverage,
  formatDate,
  fullName,
  periodTime,
  todayWeekday,
} from './format'

describe('format helpers', () => {
  it('formats date-only values without shifting the day', () => {
    expect(formatDate('2026-10-20')).toBe('20 Oct 2026')
    expect(formatDate(null)).toBe('—')
  })

  it('shows averages with two decimals, like a report card', () => {
    expect(formatAverage(8.5)).toBe('8.50')
    expect(formatAverage(null)).toBe('—')
  })

  it('maps periods to lesson times', () => {
    expect(periodTime(1)).toBe('08:00–08:50')
    expect(periodTime(8)).toBe('15:00–15:50')
  })

  it('returns the school day, or null at the weekend', () => {
    expect(todayWeekday(new Date(2026, 9, 20))).toBe('TUESDAY')
    expect(todayWeekday(new Date(2026, 9, 18))).toBeNull()
  })

  it('joins first and last name', () => {
    expect(fullName({ firstName: 'Ana', lastName: 'Popescu' })).toBe(
      'Ana Popescu',
    )
    expect(fullName(null)).toBe('—')
  })
})
