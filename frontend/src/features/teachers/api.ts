import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import type { operations } from '@/api/schema'

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

export function useTeacher(id: string) {
  return useQuery({
    queryKey: queryKeys.teachers.detail(id),
    queryFn: () =>
      unwrap(api.GET('/api/teachers/{id}', { params: { path: { id } } })),
  })
}

/** The logged-in teacher with their classes and subjects (teacher only). */
export function useMyTeacherProfile() {
  return useQuery({
    queryKey: queryKeys.teachers.me,
    queryFn: () => unwrap(api.GET('/api/teachers/me')),
    staleTime: 5 * 60 * 1000,
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
