import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'

export type SchoolYear = Schemas['SchoolYearDto']
export type SchoolYearSummary = Schemas['SchoolYearSummaryDto']
export type ClosingPreview = Schemas['ClosingPreviewDto']
export type ClosingClass = Schemas['ClosingClassDto']
export type ClosingStudent = Schemas['ClosingStudentDto']
export type YearOutcome = Schemas['OutcomeDecisionDto']['outcome']
export type Semester = 1 | 2

/** The years the user can look at, newest first (the open one included). */
export function useSchoolYears(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.schoolYears.list,
    queryFn: () => unwrap(api.GET('/api/school-years')),
    staleTime: 5 * 60_000,
    enabled: options.enabled,
  })
}

/**
 * Ending a semester or a year changes what every page shows (which year is
 * open, which grades can change): everything is reloaded.
 */
function useRefreshEverything() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

export function useEndSemester() {
  const refresh = useRefreshEverything()
  return useMutation({
    mutationFn: () =>
      unwrap(api.POST('/api/school-years/current/end-semester')),
    onSuccess: refresh,
    meta: { successMessage: 'Semester 1 ended: semester 2 has started' },
  })
}

export function useClosingPreview(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.schoolYears.closing,
    queryFn: () => unwrap(api.GET('/api/school-years/current/closing')),
    enabled,
  })
}

export function useSaveReexam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Schemas['SaveReexamDto']) =>
      unwrap(api.PUT('/api/school-years/current/reexams', { body })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.schoolYears.closing,
      }),
    meta: { successMessage: 'Re-exam grade saved' },
  })
}

export function useRemoveReexam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      studentId,
      subjectId,
    }: {
      studentId: string
      subjectId: string
    }) =>
      unwrap(
        api.DELETE(
          '/api/school-years/current/reexams/{studentId}/{subjectId}',
          {
            params: { path: { studentId, subjectId } },
          },
        ),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.schoolYears.closing,
      }),
  })
}

/**
 * Closing the year. The caller refreshes everything (`refreshAll`) once it
 * has left the closing page, which only makes sense while the year is open.
 */
export function useCloseYear() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (body: Schemas['CloseYearDto']) =>
      unwrap(api.POST('/api/school-years/current/close', { body })),
  })
  const refreshAll = () => {
    // Not the preview: it was of the year just closed.
    return queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[1] !== 'closing',
    })
  }
  return { ...mutation, refreshAll }
}
