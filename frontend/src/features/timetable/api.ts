import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'

export type Timetable = Schemas['TimetableDto']
export type Lesson = Schemas['TimetableLessonDto']
export type TimetableConflict = Schemas['TimetableConflictDto']
export type FreeSlot = Schemas['FreeSlotDto']

/** The conflict described by a 409 from the timetable endpoints, if any. */
export function timetableConflictOf(error: unknown): TimetableConflict | null {
  return error instanceof ApiError &&
    error.status === 409 &&
    typeof error.conflict === 'object' &&
    error.conflict !== null &&
    'type' in error.conflict
    ? (error.conflict as TimetableConflict)
    : null
}

/** Slots where a subject could go: the class and its teacher are both free. */
export function useFreeSlots(
  classSubjectId: string | null,
  excludeLessonId?: string,
) {
  return useQuery({
    queryKey: [
      ...queryKeys.timetable.all,
      'free-slots',
      classSubjectId,
      excludeLessonId ?? null,
    ],
    queryFn: () =>
      unwrap(
        api.GET('/api/class-subjects/{id}/free-slots', {
          params: {
            path: { id: classSubjectId! },
            query: { excludeLessonId },
          },
        }),
      ),
    enabled: classSubjectId !== null,
  })
}

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

/** Lessons can also change a subject's weekly hours, shown with the class. */
function useInvalidateTimetables() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all }),
    ])
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
    meta: { successMessage: 'Lesson added', handlesConflicts: true },
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
    meta: { successMessage: 'Lesson updated', handlesConflicts: true },
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
