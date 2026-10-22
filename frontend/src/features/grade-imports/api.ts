import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'

export type GradeImportResult = Schemas['GradeImportResultDto']
export type ImportedGradeRow = Schemas['ImportedGradeRowDto']
export type GradeImportOption = Schemas['GradeImportOptionDto']

/** The subjects the user can import grades for, each with its classes. */
export function useGradeImportOptions() {
  return useQuery({
    queryKey: queryKeys.classes.gradeImportOptions,
    queryFn: () => unwrap(api.GET('/api/grade-imports/options')),
  })
}

/**
 * Reads grades from an .xlsx or .csv file, for one class or (without
 * classId) every class of the subject. Nothing is saved on the server.
 */
export function useImportGrades() {
  return useMutation({
    mutationFn: ({
      subjectId,
      classId,
      file,
    }: {
      subjectId: string
      classId: string | null
      file: File
    }) =>
      unwrap(
        api.POST('/api/grade-imports', {
          // The typed body only documents the fields; the real one is FormData.
          body: { subjectId, file: '' },
          bodySerializer: () => {
            const form = new FormData()
            form.append('subjectId', subjectId)
            if (classId) form.append('classId', classId)
            form.append('file', file, file.name)
            return form
          },
        }),
      ),
  })
}

/** Saves reviewed grades of students of one or more classes, all or none. */
export function useSaveImportedGrades() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Schemas['CreateGradesBatchDto']) =>
      unwrap(api.POST('/api/grades/batch', { body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.grades.all }),
  })
}

/** Downloads the Excel template, with the class, reg. no. and name of every student. */
export async function downloadTemplate(
  subjectId: string,
  classId: string | null,
): Promise<void> {
  const { data, response } = await api.GET('/api/grade-imports/template', {
    params: { query: { subjectId, ...(classId ? { classId } : {}) } },
    parseAs: 'blob',
  })
  if (!response.ok || !data) {
    throw new Error('The template could not be downloaded')
  }
  const fileName =
    /filename="([^"]+)"/.exec(
      response.headers.get('content-disposition') ?? '',
    )?.[1] ?? 'grades.xlsx'

  const url = URL.createObjectURL(data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
