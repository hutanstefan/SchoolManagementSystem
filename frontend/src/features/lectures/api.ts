import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import type { operations } from '@/api/schema'

export type Lecture = Schemas['LectureDto']
export type LectureDetail = Schemas['LectureDetailDto']
export type LectureStudent = Schemas['LectureStudentDto']
type LectureQuery = NonNullable<
  operations['LecturesController_findAll']['parameters']['query']
>

/** Biggest PDF the API takes (same as the backend's limit). */
export const MAX_LECTURE_BYTES = 20 * 1024 * 1024

/**
 * The lectures the user can see, newest first, a page at a time: admins
 * all, teachers their library, students the ones they can read. Not tied
 * to the school year.
 */
export function useLectures(query: LectureQuery = {}) {
  return useQuery({
    queryKey: queryKeys.lectures.list(query),
    queryFn: () => unwrap(api.GET('/api/lectures', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}

/** One lecture, with who can read it (for the people who manage it). */
export function useLecture(id: string | null) {
  return useQuery({
    queryKey: queryKeys.lectures.detail(id ?? ''),
    queryFn: () =>
      unwrap(api.GET('/api/lectures/{id}', { params: { path: { id: id! } } })),
    enabled: id !== null,
  })
}

export type LectureAccessChange = Schemas['LectureAccessChangeDto']

/** Who got or lost access to a lecture, newest first, a page at a time. */
export function useLectureHistory(id: string | null, page: number) {
  return useQuery({
    queryKey: queryKeys.lectures.history(id ?? '', page),
    queryFn: () =>
      unwrap(
        api.GET('/api/lectures/{id}/history', {
          params: { path: { id: id! }, query: { page, pageSize: 10 } },
        }),
      ),
    enabled: id !== null,
    placeholderData: keepPreviousData,
  })
}

/** Every student a lecture can be shared with, from any class. */
export function useRecipients(enabled = true) {
  return useQuery({
    queryKey: queryKeys.lectures.recipients,
    queryFn: () => unwrap(api.GET('/api/lectures/recipients')),
    staleTime: 5 * 60_000,
    enabled,
  })
}

/** A link valid for a few minutes, to show or save the PDF. */
export function lectureLink(id: string, download = false) {
  return unwrap(
    api.GET('/api/lectures/{id}/link', {
      params: { path: { id }, query: { download } },
    }),
  )
}

function useInvalidateLectures() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.lectures.all })
}

export interface NewLecture {
  title: string
  description: string
  subjectId: string
  studentIds: string[]
  file: File
}

export function useCreateLecture() {
  const invalidate = useInvalidateLectures()
  return useMutation({
    mutationFn: ({
      title,
      description,
      subjectId,
      studentIds,
      file,
    }: NewLecture) =>
      unwrap(
        api.POST('/api/lectures', {
          // The typed body only documents the fields; the real one is FormData.
          body: { title, subjectId, file: '' },
          bodySerializer: () => {
            const form = new FormData()
            form.append('title', title)
            if (description) form.append('description', description)
            form.append('subjectId', subjectId)
            form.append('studentIds', JSON.stringify(studentIds))
            form.append('file', file, file.name)
            return form
          },
        }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Lecture added' },
  })
}

export function useUpdateLecture() {
  const invalidate = useInvalidateLectures()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Schemas['UpdateLectureDto']
    }) =>
      unwrap(
        api.PATCH('/api/lectures/{id}', { params: { path: { id } }, body }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Lecture updated' },
  })
}

export function useSetLectureStudents() {
  const invalidate = useInvalidateLectures()
  return useMutation({
    mutationFn: ({ id, studentIds }: { id: string; studentIds: string[] }) =>
      unwrap(
        api.PUT('/api/lectures/{id}/students', {
          params: { path: { id } },
          body: { studentIds },
        }),
      ),
    onSuccess: invalidate,
    meta: { successMessage: 'Access updated' },
  })
}

export function useDeleteLecture() {
  const invalidate = useInvalidateLectures()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/lectures/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
    meta: { successMessage: 'Lecture deleted' },
  })
}
