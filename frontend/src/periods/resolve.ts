import type { SchoolYear, Semester } from '@/features/school-years/api'

/** What the viewer picked; null follows the school's current period. */
export interface PeriodSelection {
  schoolYearId: string
  semester: Semester
}

export interface ResolvedPeriod {
  /** The year being looked at (undefined only while there are no years). */
  year: SchoolYear | undefined
  semester: Semester
  /** The open year, where new data goes. */
  activeYear: SchoolYear | undefined
  /** The open year's current semester: what everyone sees by default. */
  isCurrent: boolean
  /** A closed year: everything can only be looked at. */
  isArchived: boolean
  /** An ended semester of the open year: only an admin can change grades. */
  isEndedSemester: boolean
}

/** The semester shown by default for a year: its current one, or the last. */
export function defaultSemester(year: SchoolYear): Semester {
  return year.status === 'ACTIVE' ? year.currentSemester : 2
}

/** The semesters of a year that have started (a future one has no data). */
export function startedSemesters(year: SchoolYear | undefined): Semester[] {
  return year?.status === 'ACTIVE' && year.currentSemester === 1 ? [1] : [1, 2]
}

/**
 * Turns the viewer's choice into the period to show. A choice that no longer
 * makes sense (a year that is gone, a semester that hasn't started) falls
 * back to the current period.
 */
export function resolvePeriod(
  years: SchoolYear[],
  selection: PeriodSelection | null,
): ResolvedPeriod {
  const activeYear = years.find((y) => y.status === 'ACTIVE')
  const picked = selection
    ? years.find((y) => y.id === selection.schoolYearId)
    : undefined
  const year = picked ?? activeYear ?? years[0]
  let semester: Semester = year ? defaultSemester(year) : 1
  if (
    picked &&
    selection &&
    startedSemesters(year).includes(selection.semester)
  )
    semester = selection.semester

  return {
    year,
    semester,
    activeYear,
    isCurrent:
      !!year &&
      year.id === activeYear?.id &&
      semester === activeYear.currentSemester,
    isArchived: year?.status === 'CLOSED',
    isEndedSemester:
      year?.status === 'ACTIVE' && semester < year.currentSemester,
  }
}

/** "2026–2027 · Semester 1" */
export function periodLabel(year: SchoolYear | undefined, semester: Semester) {
  return year ? `${year.name} · Semester ${semester}` : `Semester ${semester}`
}
