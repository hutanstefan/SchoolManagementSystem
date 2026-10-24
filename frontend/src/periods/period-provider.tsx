import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/auth-context'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { useSchoolYears, type Semester } from '@/features/school-years/api'
import { storage } from '@/lib/storage'
import { PeriodContext, type PeriodContextValue } from './period-context'
import { defaultSemester, resolvePeriod, type PeriodSelection } from './resolve'

function readSelection(key: string): PeriodSelection | null {
  try {
    const value = JSON.parse(storage.get(key) ?? 'null') as unknown
    if (
      value &&
      typeof value === 'object' &&
      'schoolYearId' in value &&
      typeof value.schoolYearId === 'string' &&
      'semester' in value &&
      (value.semester === 1 || value.semester === 2)
    )
      return { schoolYearId: value.schoolYearId, semester: value.semester }
  } catch {
    // A broken value: show the current period.
  }
  return null
}

/**
 * Keeps the school year and semester every page shows. By default that is
 * the school's current period; a viewer who picks another one keeps it
 * (per user, across reloads) until they go back.
 */
export function PeriodProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const key = `sms.period.${user?.id ?? 'anonymous'}`
  const years = useSchoolYears()
  const [selection, setSelection] = useState(() => readSelection(key))

  const select = useCallback(
    (next: PeriodSelection | null) => {
      setSelection(next)
      if (next) storage.set(key, JSON.stringify(next))
      else storage.remove(key)
    },
    [key],
  )

  const value = useMemo<PeriodContextValue>(() => {
    const list = years.data ?? []
    const resolved = resolvePeriod(list, selection)
    const { year, semester, activeYear } = resolved
    /** Picking the current period again goes back to following it. */
    const pick = (schoolYearId: string, next: Semester) =>
      select(
        schoolYearId === activeYear?.id && next === activeYear.currentSemester
          ? null
          : { schoolYearId, semester: next },
      )
    return {
      ...resolved,
      years: list,
      query: year ? { schoolYearId: year.id, semester } : {},
      setYear: (id) => {
        const target = list.find((y) => y.id === id)
        if (target) pick(id, defaultSemester(target))
      },
      setSemester: (next) => year && pick(year.id, next),
      reset: () => select(null),
    }
  }, [years.data, selection, select])

  // Pages ask for data of the chosen period: wait until it is known. If the
  // years can't be loaded the API's defaults (the current period) still work.
  if (years.isPending) return <FullPageSpinner />
  return (
    <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
  )
}
