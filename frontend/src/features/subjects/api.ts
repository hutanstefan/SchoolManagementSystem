import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'

export type Subject = Schemas['SubjectDto']

export function useSubjects() {
  return useQuery({
    queryKey: queryKeys.subjects.all,
    queryFn: () => unwrap(api.GET('/api/subjects')),
    staleTime: 5 * 60_000,
  })
}

function useInvalidateSubjects() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.subjects.all })
}

export function useCreateSubject() {
  const invalidate = useInvalidateSubjects()
  return useMutation({
    mutationFn: (body: Schemas['CreateSubjectDto']) =>
      unwrap(api.POST('/api/subjects', { body })),
    onSuccess: invalidate,
    meta: { successMessage: 'Subject created' },
  })
}

export function useUpdateSubject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Schemas['UpdateSubjectDto']
    }) =>
      unwrap(
        api.PATCH('/api/subjects/{id}', { params: { path: { id } }, body }),
      ),
    // The name and colour show up in classes, timetables, grades and charts.
    onSuccess: () => queryClient.invalidateQueries(),
    meta: { successMessage: 'Subject updated' },
  })
}

export function useDeleteSubject() {
  const invalidate = useInvalidateSubjects()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/subjects/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
    meta: { successMessage: 'Subject deleted' },
  })
}
