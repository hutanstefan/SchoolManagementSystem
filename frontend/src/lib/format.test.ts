import { describe, expect, it } from 'vitest'
import {
  compareClassNames,
  currentPeriod,
  formatAverage,
  formatDate,
  fullName,
  isPeriodOver,
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

  it('finds the period being taught, ignoring breaks', () => {
    expect(currentPeriod(new Date(2026, 9, 20, 7, 59))).toBeNull()
    expect(currentPeriod(new Date(2026, 9, 20, 8, 0))).toBe(1)
    expect(currentPeriod(new Date(2026, 9, 20, 9, 49))).toBe(2)
    expect(currentPeriod(new Date(2026, 9, 20, 9, 55))).toBeNull()
    expect(currentPeriod(new Date(2026, 9, 20, 16, 0))).toBeNull()
  })

  it('knows when a period is over', () => {
    expect(isPeriodOver(1, new Date(2026, 9, 20, 8, 49))).toBe(false)
    expect(isPeriodOver(1, new Date(2026, 9, 20, 8, 50))).toBe(true)
  })

  it('sorts class names naturally', () => {
    expect(['10A', '9B', '12A', '9A'].sort(compareClassNames)).toEqual([
      '9A',
      '9B',
      '10A',
      '12A',
    ])
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
