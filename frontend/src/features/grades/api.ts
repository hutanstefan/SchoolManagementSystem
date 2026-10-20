import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import type { operations } from '@/api/schema'

export type Grade = Schemas['GradeDto']
export type GradeEntry = Schemas['GradeEntryDto']
export type Gradebook = Schemas['GradebookDto']
export type StudentReport = Schemas['StudentGradesReportDto']
export type GradeQuery = NonNullable<
  operations['GradesController_findAll']['parameters']['query']
>

export function useGrades(query: GradeQuery) {
  return useQuery({
    queryKey: queryKeys.grades.list(query),
    queryFn: () => unwrap(api.GET('/api/grades', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}

export function useGradeHistory(id: string | null) {
  return useQuery({
    queryKey: queryKeys.grades.history(id ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/grades/{id}/history', {
          params: { path: { id: id! } },
        }),
      ),
    enabled: id !== null,
  })
}

export function useGradebook(classId: string, subjectId: string | null) {
  return useQuery({
    queryKey: queryKeys.grades.gradebook(classId, subjectId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/classes/{id}/gradebook', {
          params: { path: { id: classId }, query: { subjectId: subjectId! } },
        }),
      ),
    enabled: subjectId !== null,
  })
}

export function useStudentReport(studentId: string) {
  return useQuery({
    queryKey: queryKeys.grades.studentReport(studentId),
    queryFn: () =>
      unwrap(
        api.GET('/api/students/{id}/grades', {
          params: { path: { id: studentId } },
        }),
      ),
  })
}

export function useMyReport() {
  return useQuery({
    queryKey: queryKeys.grades.myReport,
    queryFn: () => unwrap(api.GET('/api/grades/me')),
  })
}

function useInvalidateGrades() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.grades.all })
}

export function useCreateGrade() {
  const invalidate = useInvalidateGrades()
  return useMutation({
    mutationFn: (body: Schemas['CreateGradeDto']) =>
      unwrap(api.POST('/api/grades', { body })),
    onSuccess: invalidate,
    meta: { successMessage: 'Grade added' },
  })
}

export function useUpdateGrade() {
  const invalidate = useInvalidateGrades()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Schemas['UpdateGradeDto']
    }) =>
      unwrap(api.PATCH('/api/grades/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
    meta: { successMessage: 'Grade updated' },
  })
}

export function useDeleteGrade() {
  const invalidate = useInvalidateGrades()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/grades/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
    meta: { successMessage: 'Grade deleted' },
  })
}
