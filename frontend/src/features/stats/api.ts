import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import { usePeriodQuery } from '@/periods/period-context'

export type SchoolStats = Schemas['SchoolStatsDto']
export type TeachingStats = Schemas['TeachingStatsDto']
export type TeachingStatsRow = Schemas['TeachingStatsRowDto']
export type GradeCount = Schemas['GradeCountDto']
export type WeekActivity = Schemas['WeekActivityDto']

/** School-wide figures for the admin dashboard. */
export function useSchoolStats() {
  const query = usePeriodQuery()
  return useQuery({
    queryKey: queryKeys.grades.schoolStats(query),
    queryFn: () => unwrap(api.GET('/api/stats/school', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}

/** The signed-in teacher's classes and subjects at a glance. */
export function useTeachingStats() {
  const query = usePeriodQuery()
  return useQuery({
    queryKey: queryKeys.grades.teachingStats(query),
    queryFn: () =>
      unwrap(api.GET('/api/stats/teaching', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}
