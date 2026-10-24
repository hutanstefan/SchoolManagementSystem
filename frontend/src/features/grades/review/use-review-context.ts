import { useQueries } from '@tanstack/react-query'
import { api, unwrap } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import { useAuth } from '@/auth/auth-context'
import { useMyTeacherProfile } from '@/features/teachers/api'
import type { GradeEntry } from '../api'
import type { ReviewContext } from './review'

/**
 * The existing grades in the subject of every student of the classes (from
 * their gradebooks) and who may replace which grade: admins any, teachers
 * only the ones they gave.
 */
export function useReviewContext(
  classIds: string[],
  subjectId: string,
  batchDate: string,
): {
  context: ReviewContext
  canReplace: (grade: GradeEntry) => boolean
} {
  const { user } = useAuth()
  const gradebooks = useQueries({
    queries: classIds.map((classId) => ({
      queryKey: queryKeys.grades.gradebook(classId, subjectId),
      queryFn: () =>
        unwrap(
          api.GET('/api/classes/{id}/gradebook', {
            params: { path: { id: classId }, query: { subjectId } },
          }),
        ),
      enabled: subjectId !== '',
    })),
  })
  const isTeacher = user?.role === 'TEACHER'
  const me = useMyTeacherProfile({ enabled: isTeacher, year: 'open' })

  const byStudent = new Map(
    gradebooks.flatMap((gradebook) =>
      (gradebook.data?.students ?? []).map(
        (row) => [row.student.id, row.grades] as const,
      ),
    ),
  )
  return {
    context: {
      batchDate,
      gradesOf: (studentId) => byStudent.get(studentId) ?? [],
    },
    canReplace: (grade) =>
      !isTeacher || (me.data !== undefined && grade.teacher?.id === me.data.id),
  }
}
