import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'

export type Timetable = Schemas['TimetableDto']
export type Lesson = Schemas['TimetableLessonDto']

export function useClassTimetable(classId: string) {
  return useQuery({
    queryKey: queryKeys.timetable.class(classId),
    queryFn: () =>
      unwrap(
        api.GET('/api/classes/{id}/timetable', {
          params: { path: { id: classId } },
        }),
      ),
  })
}

export function useTeacherTimetable(teacherId: string) {
  return useQuery({
    queryKey: queryKeys.timetable.teacher(teacherId),
    queryFn: () =>
      unwrap(
        api.GET('/api/teachers/{id}/timetable', {
          params: { path: { id: teacherId } },
        }),
      ),
  })
}

export function useMyTimetable() {
  return useQuery({
    queryKey: queryKeys.timetable.me,
    queryFn: () => unwrap(api.GET('/api/timetable/me')),
  })
}

function useInvalidateTimetables() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.timetable.all })
}

export function useAddLesson() {
  const invalidate = useInvalidateTimetables()
  return useMutation({
    mutationFn: ({
      classId,
      body,
    }: {
      classId: string
      body: Schemas['CreateTimetableEntryDto']
    }) =>
      unwrap(
        api.POST('/api/classes/{id}/timetable', {
          params: { path: { id: classId } },
          body,
        }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Lesson added' },
  })
}

export function useUpdateLesson() {
  const invalidate = useInvalidateTimetables()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Schemas['UpdateTimetableEntryDto']
    }) =>
      unwrap(
        api.PATCH('/api/timetable-entries/{id}', {
          params: { path: { id } },
          body,
        }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Lesson updated' },
  })
}

export function useDeleteLesson() {
  const invalidate = useInvalidateTimetables()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE('/api/timetable-entries/{id}', {
          params: { path: { id } },
        }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Lesson removed' },
  })
}
