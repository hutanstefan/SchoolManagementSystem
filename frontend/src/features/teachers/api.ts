import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import type { operations } from '@/api/schema'
import { usePeriod } from '@/periods/period-context'

export type Teacher = Schemas['TeacherDto']
export type TeacherDetail = Schemas['TeacherDetailDto']
export type TeacherQuery = NonNullable<
  operations['TeachersController_findAll']['parameters']['query']
>

export function useTeachers(query: TeacherQuery) {
  return useQuery({
    queryKey: queryKeys.teachers.list(query),
    queryFn: () => unwrap(api.GET('/api/teachers', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}

/** Every teacher, for select boxes (a school has well under 100). */
export function useAllTeachers() {
  return useTeachers({ pageSize: 100, sort: 'lastName' })
}

/** A teacher with their classes and subjects in the picked year. */
export function useTeacher(id: string) {
  const schoolYearId = usePeriod().year?.id
  return useQuery({
    queryKey: queryKeys.teachers.detail(id, schoolYearId),
    queryFn: () =>
      unwrap(
        api.GET('/api/teachers/{id}', {
          params: { path: { id }, query: { schoolYearId } },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

/**
 * The logged-in teacher with their classes and subjects (teacher only), in
 * the picked year or, with `'open'`, in the year that can still change.
 */
export function useMyTeacherProfile(
  options: { enabled?: boolean; year?: 'open' } = {},
) {
  const period = usePeriod()
  const schoolYearId =
    options.year === 'open' ? period.activeYear?.id : period.year?.id
  return useQuery({
    queryKey: queryKeys.teachers.meIn(schoolYearId),
    queryFn: () =>
      unwrap(
        api.GET('/api/teachers/me', { params: { query: { schoolYearId } } }),
      ),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    enabled: options.enabled ?? true,
  })
}

function useInvalidateTeachers() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.all }),
    ])
}

export function useCreateTeacher() {
  const invalidate = useInvalidateTeachers()
  return useMutation({
    mutationFn: (body: Schemas['CreateTeacherDto']) =>
      unwrap(api.POST('/api/teachers', { body })),
    onSuccess: invalidate,
    meta: { successMessage: 'Teacher created' },
  })
}

export function useUpdateTeacher() {
  const invalidate = useInvalidateTeachers()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Schemas['UpdateTeacherDto']
    }) =>
      unwrap(
        api.PATCH('/api/teachers/{id}', { params: { path: { id } }, body }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Teacher updated' },
  })
}

export function useDeleteTeacher() {
  const invalidate = useInvalidateTeachers()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/teachers/{id}', { params: { path: { id } } })),
    // Not awaited: the detail page navigates away before the list refetches.
    onSuccess: () => {
      void invalidate()
    },
    meta: { successMessage: 'Teacher deleted' },
  })
}
