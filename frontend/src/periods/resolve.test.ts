import { describe, expect, it } from 'vitest'
import type { SchoolYear } from '@/features/school-years/api'
import { resolvePeriod, startedSemesters } from './resolve'

const year = (
  id: string,
  status: SchoolYear['status'],
  currentSemester: 1 | 2,
): SchoolYear => ({
  id,
  startYear: id === 'old' ? 2025 : 2026,
  name: id === 'old' ? '2025–2026' : '2026–2027',
  status,
  currentSemester,
  semester1EndedAt: null,
  closedAt: null,
})

const open = year('open', 'ACTIVE', 1)
const closed = year('old', 'CLOSED', 2)

describe('resolvePeriod', () => {
  it("shows the open year's current semester by default", () => {
    const period = resolvePeriod([open, closed], null)
    expect(period.year?.id).toBe('open')
    expect(period.semester).toBe(1)
    expect(period).toMatchObject({ isCurrent: true, isArchived: false })
  })

  it('shows a closed year read-only, on the picked semester', () => {
    const period = resolvePeriod([open, closed], {
      schoolYearId: 'old',
      semester: 1,
    })
    expect(period.year?.id).toBe('old')
    expect(period.semester).toBe(1)
    expect(period).toMatchObject({ isCurrent: false, isArchived: true })
  })

  it("never shows a semester that hasn't started", () => {
    const period = resolvePeriod([open], { schoolYearId: 'open', semester: 2 })
    expect(period.semester).toBe(1)
    expect(startedSemesters(open)).toEqual([1])
  })

  it('marks an ended semester of the open year', () => {
    const inS2 = year('open', 'ACTIVE', 2)
    const period = resolvePeriod([inS2], { schoolYearId: 'open', semester: 1 })
    expect(period).toMatchObject({ isEndedSemester: true, isCurrent: false })
  })

  it('falls back to the current period when the picked year is gone', () => {
    const period = resolvePeriod([open], { schoolYearId: 'gone', semester: 2 })
    expect(period.year?.id).toBe('open')
    expect(period.isCurrent).toBe(true)
  })
})
