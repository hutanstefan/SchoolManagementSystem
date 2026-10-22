import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'

export type GradeScanResult = Schemas['GradeScanResultDto']
export type ScannedTest = Schemas['ScannedTestDto']
export type Confidence = ScannedTest['confidence']

/** Sends photos of tests to be read. Nothing is saved on the server. */
export function useScanTests() {
  return useMutation({
    mutationFn: ({
      classId,
      subjectId,
      images,
    }: {
      classId: string
      subjectId: string
      images: File[]
    }) =>
      unwrap(
        api.POST('/api/classes/{id}/grade-scans', {
          params: { path: { id: classId } },
          // The typed body only documents the fields; the real one is FormData.
          body: { subjectId, images: [] },
          bodySerializer: () => {
            const form = new FormData()
            form.append('subjectId', subjectId)
            for (const image of images) form.append('images', image, image.name)
            return form
          },
        }),
      ),
  })
}

/** Saves the reviewed grades in one transaction (all or nothing). */
export function useSaveGradesBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      classId,
      body,
    }: {
      classId: string
      body: Schemas['CreateGradesBatchDto']
    }) =>
      unwrap(
        api.POST('/api/classes/{id}/grades', {
          params: { path: { id: classId } },
          body,
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.grades.all }),
  })
}
