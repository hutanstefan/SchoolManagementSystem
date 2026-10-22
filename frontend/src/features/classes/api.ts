import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import type { operations } from '@/api/schema'

export type SchoolClass = Schemas['ClassDto']
export type ClassDetail = Schemas['ClassDetailDto']
export type ClassSubject = Schemas['ClassSubjectSummaryDto']
export type ClassQuery = NonNullable<
  operations['ClassesController_findAll']['parameters']['query']
>

export function useClasses(query: ClassQuery = {}) {
  return useQuery({
    queryKey: queryKeys.classes.list(query),
    queryFn: () => unwrap(api.GET('/api/classes', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}

/** Every class the user can see, for select boxes. */
export function useAllClasses() {
  return useClasses({ pageSize: 100 })
}

export function useClass(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.classes.detail(id),
    queryFn: () =>
      unwrap(api.GET('/api/classes/{id}', { params: { path: { id } } })),
    enabled: options.enabled ?? true,
  })
}

export function useClassStudents(id: string) {
  return useQuery({
    queryKey: queryKeys.classes.students(id),
    queryFn: () =>
      unwrap(
        api.GET('/api/classes/{id}/students', { params: { path: { id } } }),
      ),
  })
}

/** Class changes ripple into students, teachers, timetables and grades. */
function useInvalidateSchool() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      [
        queryKeys.classes.all,
        queryKeys.students.all,
        queryKeys.teachers.all,
        queryKeys.timetable.all,
        queryKeys.grades.all,
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )
}

export function useCreateClass() {
  const invalidate = useInvalidateSchool()
  return useMutation({
    mutationFn: (body: Schemas['CreateClassDto']) =>
      unwrap(api.POST('/api/classes', { body })),
    onSuccess: invalidate,
    meta: { successMessage: 'Class created' },
  })
}

export function useUpdateClass() {
  const invalidate = useInvalidateSchool()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Schemas['UpdateClassDto']
    }) =>
      unwrap(
        api.PATCH('/api/classes/{id}', { params: { path: { id } }, body }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Class updated' },
  })
}

export function useDeleteClass() {
  const invalidate = useInvalidateSchool()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/classes/{id}', { params: { path: { id } } })),
    // Not awaited: the detail page navigates away before the list refetches.
    onSuccess: () => {
      void invalidate()
    },
    meta: { successMessage: 'Class deleted' },
  })
}

export function useAssignStudents() {
  const invalidate = useInvalidateSchool()
  return useMutation({
    mutationFn: ({ id, studentIds }: { id: string; studentIds: string[] }) =>
      unwrap(
        api.POST('/api/classes/{id}/students', {
          params: { path: { id } },
          body: { studentIds },
        }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Students added to the class' },
  })
}

export function useRemoveStudentFromClass() {
  const invalidate = useInvalidateSchool()
  return useMutation({
    mutationFn: ({ id, studentId }: { id: string; studentId: string }) =>
      unwrap(
        api.DELETE('/api/classes/{id}/students/{studentId}', {
          params: { path: { id, studentId } },
        }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Student removed from the class' },
  })
}

export function useAddClassSubject() {
  const invalidate = useInvalidateSchool()
  return useMutation({
    mutationFn: ({
      classId,
      body,
    }: {
      classId: string
      body: Schemas['CreateClassSubjectDto']
    }) =>
      unwrap(
        api.POST('/api/classes/{id}/subjects', {
          params: { path: { id: classId } },
          body,
        }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Subject added to the class' },
  })
}

export function useUpdateClassSubject(
  options: { handlesConflicts?: boolean } = {},
) {
  const invalidate = useInvalidateSchool()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Schemas['UpdateClassSubjectDto']
    }) =>
      unwrap(
        api.PATCH('/api/class-subjects/{id}', {
          params: { path: { id } },
          body,
        }),
      ),
    onSuccess: invalidate,
    meta: {
      successMessage: 'Teaching assignment updated',
      handlesConflicts: options.handlesConflicts,
    },
  })
}

export function useRemoveClassSubject() {
  const invalidate = useInvalidateSchool()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE('/api/class-subjects/{id}', { params: { path: { id } } }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Subject removed from the class' },
  })
}
