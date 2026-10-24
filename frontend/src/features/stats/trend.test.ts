import { describe, expect, it } from 'vitest'
import { averageTrend } from './trend'

describe('averageTrend', () => {
  it('gives the running mean per date, oldest first', () => {
    expect(
      averageTrend([
        { value: 10, date: '2026-10-02' },
        { value: 6, date: '2026-09-20' },
        { value: 7, date: '2026-10-02T00:00:00.000Z' },
        { value: 8, date: '2026-09-21' },
      ]),
    ).toEqual([
      { date: '2026-09-20', average: 6 },
      { date: '2026-09-21', average: 7 },
      { date: '2026-10-02', average: 7.75 },
    ])
  })

  it('is empty without grades', () => {
    expect(averageTrend([])).toEqual([])
  })
})
