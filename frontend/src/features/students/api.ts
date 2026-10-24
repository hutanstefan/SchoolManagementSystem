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

export type Student = Schemas['StudentDto']
export type StudentDetail = Schemas['StudentDetailDto']
export type StudentYear = Schemas['StudentYearDto']
export type StudentQuery = NonNullable<
  operations['StudentsController_findAll']['parameters']['query']
>

/** Students of the year picked in the sidebar, with their class that year. */
export function useStudents(filters: StudentQuery) {
  const schoolYearId = usePeriod().year?.id
  const query = { schoolYearId, ...filters }
  return useQuery({
    queryKey: queryKeys.students.list(query),
    queryFn: () => unwrap(api.GET('/api/students', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}

export function useStudent(id: string) {
  const schoolYearId = usePeriod().year?.id
  return useQuery({
    queryKey: queryKeys.students.detail(id, schoolYearId),
    queryFn: () =>
      unwrap(
        api.GET('/api/students/{id}', {
          params: { path: { id }, query: { schoolYearId } },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

/** Students change class membership and grades, so refresh those too. */
function useInvalidateStudents() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.grades.all }),
    ])
}

export function useCreateStudent() {
  const invalidate = useInvalidateStudents()
  return useMutation({
    mutationFn: (body: Schemas['CreateStudentDto']) =>
      unwrap(api.POST('/api/students', { body })),
    onSuccess: invalidate,
    meta: { successMessage: 'Student created' },
  })
}

export function useUpdateStudent() {
  const invalidate = useInvalidateStudents()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Schemas['UpdateStudentDto']
    }) =>
      unwrap(
        api.PATCH('/api/students/{id}', { params: { path: { id } }, body }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Student updated' },
  })
}

export function useDeleteStudent() {
  const invalidate = useInvalidateStudents()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/students/{id}', { params: { path: { id } } })),
    // Not awaited: the detail page navigates away before the list refetches.
    onSuccess: () => {
      void invalidate()
    },
    meta: { successMessage: 'Student deleted' },
  })
}
