import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import type { operations } from '@/api/schema'
import type { Semester } from '@/features/school-years/api'

export type Absence = Schemas['AbsenceDto']
export type AbsenceCount = Schemas['AbsenceCountDto']
export type ClassAbsences = Schemas['ClassAbsencesDto']
export type ClassAbsenceRow = Schemas['ClassAbsenceRowDto']
export type AbsenceQuery = NonNullable<
  operations['AbsencesController_findAll']['parameters']['query']
>

export function useAbsences(query: AbsenceQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.absences.list(query),
    queryFn: () => unwrap(api.GET('/api/absences', { params: { query } })),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Every student of a class with their absences per subject, in a semester. */
export function useClassAbsences(classId: string, semester?: Semester) {
  return useQuery({
    queryKey: queryKeys.absences.class(classId, semester),
    queryFn: () =>
      unwrap(
        api.GET('/api/classes/{id}/absences', {
          params: { path: { id: classId }, query: { semester } },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

/** Absences show up in gradebooks and report cards too: refresh both. */
function useInvalidateAbsences() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.absences.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.grades.all }),
    ])
}

export function useTakeAttendance() {
  const invalidate = useInvalidateAbsences()
  return useMutation({
    mutationFn: (body: Schemas['TakeAttendanceDto']) =>
      unwrap(api.POST('/api/absences/attendance', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateAbsence() {
  const invalidate = useInvalidateAbsences()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Schemas['UpdateAbsenceDto']
    }) =>
      unwrap(
        api.PATCH('/api/absences/{id}', { params: { path: { id } }, body }),
      ),
    onSuccess: invalidate,
  })
}

export function useExcuseAbsences() {
  const invalidate = useInvalidateAbsences()
  return useMutation({
    mutationFn: (body: Schemas['ExcuseAbsencesDto']) =>
      unwrap(api.POST('/api/absences/excuse', { body })),
    onSuccess: invalidate,
  })
}

export function useDeleteAbsence() {
  const invalidate = useInvalidateAbsences()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/absences/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
    meta: { successMessage: 'Absence deleted' },
  })
}
