import { RefreshCw, RotateCcw, Save, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { useAuth } from '@/auth/auth-context'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states'
import { SubmitButton } from '@/components/submit-button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useClass, useClassStudents } from '@/features/classes/api'
import { todayIso } from '@/lib/format'
import {
  useSaveGradesBatch,
  useScanTests,
  type GradeScanResult,
  type ScannedTest,
} from './api'
import { PhotoPicker, type Photo } from './photo-picker'
import { prepareImage } from './prepare-image'
import { batches, gradesToSave } from '@/features/grades/review/review'
import { ReviewTable } from '@/features/grades/review/review-table'
import { useReviewContext } from '@/features/grades/review/use-review-context'
import { PhotoThumb, ScanReading } from './scan-row'
import { failedTest, toScanRow, type ScanRow } from './scan-rows'

/** Photos per page visit. */
const MAX_PHOTOS = 20
/**
 * Photos sent per request. Small requests keep each one short (a rate-limited
 * photo can take a while), show progress, and a failure only affects a few.
 */
const PHOTOS_PER_REQUEST = 4

/**
 * Scan tests: the teacher uploads photos of graded tests, an AI model reads the
 * student and the grade on each one, the teacher checks and corrects the
 * result, and the grades are saved together.
 */
export function ScanTestsPage() {
  const { id: classId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const subjectId = searchParams.get('subject') ?? ''
  const navigate = useNavigate()
  const { user } = useAuth()

  const schoolClass = useClass(classId)
  const students = useClassStudents(classId)
  const scan = useScanTests()
  const save = useSaveGradesBatch()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [result, setResult] = useState<GradeScanResult | null>(null)
  const [rows, setRows] = useState<ScanRow[]>([])
  const [date, setDate] = useState(todayIso())
  const { context, canReplace } = useReviewContext([classId], subjectId, date)
  /** Photos read so far while a scan runs, or null when idle. */
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const reading = progress !== null
  const nextId = useRef(0)

  // Free the photo previews when leaving the page.
  const urls = useRef<string[]>([])
  useEffect(() => {
    urls.current = photos.flatMap((p) => (p.url ? [p.url] : []))
  }, [photos])
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), [])

  const area = user?.role === 'ADMIN' ? 'admin' : 'teacher'
  const gradebookPath = `/${area}/classes/${classId}?tab=gradebook&subject=${subjectId}`

  const addPhotos = (files: File[]) => {
    const room = MAX_PHOTOS - photos.length
    if (files.length > room) {
      toast.error(`You can add ${room} more photo${room === 1 ? '' : 's'}.`)
    }
    for (const file of files.slice(0, Math.max(room, 0))) {
      const id = String(nextId.current++)
      setPhotos((current) => [
        ...current,
        { id, file: null, url: null, name: file.name },
      ])
      prepareImage(file)
        .then((prepared) => {
          const url = URL.createObjectURL(prepared)
          setPhotos((current) =>
            current.map((p) =>
              p.id === id ? { ...p, file: prepared, url } : p,
            ),
          )
        })
        .catch(() => {
          setPhotos((current) => current.filter((p) => p.id !== id))
          toast.error(
            `${file.name} can't be opened. Use a JPEG, PNG or WebP photo.`,
          )
        })
    }
  }

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const photo = current.find((p) => p.id === id)
      if (photo?.url) URL.revokeObjectURL(photo.url)
      return current.filter((p) => p.id !== id)
    })
  }

  const preparing = photos.some((p) => p.file === null)

  /**
   * Reads the photos at these positions, a few per request, and returns one
   * result per photo. A request that fails as a whole (no connection, limit
   * of the API) marks its photos as failed, so they can be retried.
   */
  const scanPhotos = async (
    indexes: number[],
  ): Promise<{
    tests: ScannedTest[]
    meta: Pick<GradeScanResult, 'mode' | 'model'> | null
  }> => {
    const tests: ScannedTest[] = []
    let meta: Pick<GradeScanResult, 'mode' | 'model'> | null = null
    setProgress({ done: 0, total: indexes.length })
    for (const batch of batches(indexes, PHOTOS_PER_REQUEST)) {
      try {
        const data = await scan.mutateAsync({
          classId,
          subjectId,
          images: batch.map((i) => photos[i]!.file!),
        })
        meta ??= { mode: data.mode, model: data.model }
        // The API numbers the photos of each request from 0.
        data.tests.forEach((test, j) =>
          tests.push({ ...test, index: batch[j]! }),
        )
      } catch (error) {
        for (const i of batch) {
          tests.push(failedTest(i, photos[i]!.name, errorMessage(error)))
        }
      }
      setProgress(
        (current) =>
          current && { ...current, done: current.done + batch.length },
      )
    }
    setProgress(null)
    return { tests, meta }
  }

  const read = async () => {
    const { tests, meta } = await scanPhotos(photos.map((_, i) => i))
    setResult({
      mode: meta?.mode ?? 'ai',
      model: meta?.model ?? null,
      class: { id: classId, name: schoolClass.data?.name ?? '' },
      subject: {
        id: subjectId,
        name:
          schoolClass.data?.subjects.find((s) => s.subject.id === subjectId)
            ?.subject.name ?? '',
      },
      tests,
    })
    setRows(tests.map(toScanRow))
  }

  /** Reads again only the photos that failed, keeping the teacher's other edits. */
  const retryFailed = async () => {
    const failedIndexes = rows
      .filter((row) => row.failed)
      .map((row) => row.source.index)
    const { tests } = await scanPhotos(failedIndexes)
    const byIndex = new Map(tests.map((test) => [test.index, test]))
    setRows((current) =>
      current.map((row) => {
        const test = byIndex.get(row.source.index)
        return test ? toScanRow(test) : row
      }),
    )
  }

  const startOver = () => {
    photos.forEach((p) => p.url && URL.revokeObjectURL(p.url))
    setPhotos([])
    setResult(null)
    setRows([])
  }

  const grades = gradesToSave(rows, context)
  const failedCount = rows.filter((r) => r.failed).length
  const submit = () => {
    if (!grades) return
    save.mutate(
      { classId, body: { subjectId, date, grades } },
      {
        onSuccess: ({ count }) => {
          toast.success(`${count} ${count === 1 ? 'grade' : 'grades'} saved`)
          void navigate(gradebookPath)
        },
      },
    )
  }

  if (schoolClass.isPending) return <LoadingBlock />
  if (schoolClass.error) {
    return (
      <ErrorState
        error={schoolClass.error}
        onRetry={() => void schoolClass.refetch()}
      />
    )
  }
  const subject = schoolClass.data.subjects.find(
    (s) => s.subject.id === subjectId,
  )
  if (!subject) {
    return (
      <Card>
        <EmptyState
          title="Choose a subject first"
          description="Open the gradebook, pick a subject you teach and click “Scan tests”."
        />
      </Card>
    )
  }

  const className = schoolClass.data.name
  const included = rows.filter((r) => r.include).length

  return (
    <>
      <BackLink to={gradebookPath} label={`Gradebook of ${className}`} />
      <PageHeader
        title="Scan tests"
        description={`Class ${className} · ${subject.subject.name}. AI reads the student and the grade on each photo; nothing is saved until you confirm.`}
      />

      {!result ? (
        <Card className="gap-0 py-0">
          <SectionHeader title="1. Photos of the graded tests" />
          <div className="flex flex-col gap-4 p-4">
            <PhotoPicker
              photos={photos}
              max={MAX_PHOTOS}
              disabled={reading}
              onAdd={addPhotos}
              onRemove={removePhoto}
            />
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              {progress ? (
                <ScanProgress {...progress} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Make sure the name and the final grade are visible on every
                  photo.
                </p>
              )}
              <SubmitButton
                type="button"
                pending={reading}
                disabled={photos.length === 0 || preparing}
                onClick={() => void read()}
              >
                <Sparkles aria-hidden /> Read grades
              </SubmitButton>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <SectionHeader
            title="2. Check the grades"
            action={
              <span className="text-muted-foreground text-sm">
                {result.model && `Read by ${result.model} · `}
                {included} of {rows.length} selected
              </span>
            }
          />
          {result.mode === 'demo' && (
            <div className="border-b p-4">
              <Alert>
                <Sparkles aria-hidden />
                <AlertTitle>Demo mode</AlertTitle>
                <AlertDescription>
                  No AI key is configured, so these results are simulated. Set
                  GEMINI_API_KEY (free) or ANTHROPIC_API_KEY to read the photos
                  for real.
                </AlertDescription>
              </Alert>
            </div>
          )}
          {(failedCount > 0 || progress) && (
            <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              {progress ? (
                <ScanProgress {...progress} />
              ) : (
                <p className="text-sm">
                  {failedCount} {failedCount === 1 ? 'photo' : 'photos'} could
                  not be read. Retrying usually works once the AI service is
                  less busy.
                </p>
              )}
              <SubmitButton
                type="button"
                variant="outline"
                pending={reading}
                disabled={failedCount === 0}
                onClick={() => void retryFailed()}
              >
                <RefreshCw aria-hidden /> Retry failed photos
              </SubmitButton>
            </div>
          )}
          <ReviewTable
            rows={rows}
            students={students.data ?? []}
            subjectName={result.subject.name}
            context={context}
            canReplace={canReplace}
            sourceHeader="Photo"
            renderSource={(row) => (
              <PhotoThumb
                url={photos[row.source.index]?.url ?? null}
                test={row.source}
              />
            )}
            renderRead={(row) => (
              <ScanReading test={row.source} mainModel={result.model} />
            )}
            onChange={(index, change) =>
              setRows((current) =>
                current.map((row, i) =>
                  i === index ? { ...row, ...change } : row,
                ),
              )
            }
          />
          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="grades-date">Date of the grades</Label>
              <Input
                id="grades-date"
                type="date"
                value={date}
                max={todayIso()}
                onChange={(event) => setDate(event.target.value)}
                className="w-44"
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={startOver}
                disabled={save.isPending || reading}
              >
                <RotateCcw aria-hidden /> Start over
              </Button>
              <SubmitButton
                type="button"
                pending={save.isPending}
                disabled={!grades || !date || reading}
                onClick={submit}
              >
                <Save aria-hidden /> Save {grades ? `${grades.length} ` : ''}
                {grades?.length === 1 ? 'grade' : 'grades'}
              </SubmitButton>
            </div>
          </div>
        </Card>
      )}
    </>
  )
}

/** "Reading photos… 4 of 12" with a bar. */
function ScanProgress({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-1.5" role="status">
      <p className="text-muted-foreground text-sm">
        Reading photos… {done} of {total}
      </p>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  )
}
