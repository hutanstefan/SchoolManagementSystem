import { createContext, useContext } from 'react'
import type { SchoolYear, Semester } from '@/features/school-years/api'
import type { ResolvedPeriod } from './resolve'

/** The year and semester to ask the API for; empty means "the current ones". */
export interface PeriodQuery {
  schoolYearId?: string
  semester?: Semester
}

export interface PeriodContextValue extends ResolvedPeriod {
  /** The years the viewer can look at, newest first. */
  years: SchoolYear[]
  query: PeriodQuery
  setYear: (schoolYearId: string) => void
  setSemester: (semester: Semester) => void
  /** Back to the school's current year and semester. */
  reset: () => void
}

/**
 * Outside the provider (tests, the login page) the API's defaults apply:
 * the current year and semester.
 */
const fallback: PeriodContextValue = {
  years: [],
  year: undefined,
  semester: 1,
  activeYear: undefined,
  isCurrent: true,
  isArchived: false,
  isEndedSemester: false,
  query: {},
  setYear: () => {},
  setSemester: () => {},
  reset: () => {},
}

export const PeriodContext = createContext<PeriodContextValue>(fallback)

/** The school year and semester the pages show (picked in the sidebar). */
export function usePeriod(): PeriodContextValue {
  return useContext(PeriodContext)
}

/** Just the API parameters of the period being looked at. */
export function usePeriodQuery(): PeriodQuery {
  return useContext(PeriodContext).query
}
