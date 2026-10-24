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
import { usePeriod, usePeriodQuery } from '@/periods/period-context'

export type Grade = Schemas['GradeDto']
export type GradeEntry = Schemas['GradeEntryDto']
export type Gradebook = Schemas['GradebookDto']
export type StudentReport = Schemas['StudentGradesReportDto']
export type StudentYearReport = Schemas['StudentYearReportDto']
export type SubjectYear = Schemas['SubjectYearDto']
export type GradeQuery = NonNullable<
  operations['GradesController_findAll']['parameters']['query']
>

/** Grades of the period picked in the sidebar (unless the query says). */
export function useGrades(filters: GradeQuery) {
  const query = { ...usePeriodQuery(), ...filters }
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

/** A class's grades in a subject; the class's current semester by default. */
export function useGradebook(
  classId: string,
  subjectId: string | null,
  semester?: Semester,
) {
  return useQuery({
    queryKey: queryKeys.grades.gradebook(classId, subjectId ?? '', semester),
    queryFn: () =>
      unwrap(
        api.GET('/api/classes/{id}/gradebook', {
          params: {
            path: { id: classId },
            query: { subjectId: subjectId!, semester },
          },
        }),
      ),
    enabled: subjectId !== null,
    placeholderData: keepPreviousData,
  })
}

export function useStudentReport(studentId: string) {
  const query = usePeriodQuery()
  return useQuery({
    queryKey: queryKeys.grades.studentReport(studentId, query),
    queryFn: () =>
      unwrap(
        api.GET('/api/students/{id}/grades', {
          params: { path: { id: studentId }, query },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function useMyReport() {
  const query = usePeriodQuery()
  return useQuery({
    queryKey: queryKeys.grades.myReport(query),
    queryFn: () => unwrap(api.GET('/api/grades/me', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}

/** A student's whole year of the picked period: both semesters and results. */
export function useStudentYear(studentId: string, enabled = true) {
  const schoolYearId = usePeriod().year?.id
  return useQuery({
    queryKey: queryKeys.grades.studentYear(studentId, schoolYearId),
    queryFn: () =>
      unwrap(
        api.GET('/api/students/{id}/grades/year', {
          params: { path: { id: studentId }, query: { schoolYearId } },
        }),
      ),
    enabled,
  })
}

export function useMyYear(enabled = true) {
  const schoolYearId = usePeriod().year?.id
  return useQuery({
    queryKey: queryKeys.grades.myYear(schoolYearId),
    queryFn: () =>
      unwrap(
        api.GET('/api/grades/me/year', { params: { query: { schoolYearId } } }),
      ),
    enabled,
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
