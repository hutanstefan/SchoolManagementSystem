import { Download, FileSpreadsheet, RotateCcw, Save } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { useAuth } from '@/auth/auth-context'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { gradesToSave } from '@/features/grades/review/review'
import { ReviewTable } from '@/features/grades/review/review-table'
import { useReviewContext } from '@/features/grades/review/use-review-context'
import { formatDate, todayIso } from '@/lib/format'
import {
  downloadTemplate,
  useGradeImportOptions,
  useImportGrades,
  useSaveImportedGrades,
  type GradeImportOption,
  type GradeImportResult,
} from './api'
import { toImportRow, type ImportRow } from './import-rows'

const ALL_CLASSES = '__all__'

/**
 * Import grades from Excel, for one class or all of them: pick the subject,
 * download the template (class, reg. no. and name of every student), type
 * the grades, upload it, check every row and save them together.
 *
 * The subject and class live in the URL (?subject=&class=), so the gradebook
 * can link straight to its class.
 */
export function ImportGradesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const options = useGradeImportOptions()
  const area = user?.role === 'ADMIN' ? 'admin' : 'teacher'

  if (options.isPending) return <LoadingBlock />
  if (options.error) {
    return (
      <ErrorState
        error={options.error}
        onRetry={() => void options.refetch()}
      />
    )
  }

  const option =
    options.data.find((o) => o.subject.id === searchParams.get('subject')) ??
    options.data[0]
  const classId =
    option?.classes.find((c) => c.id === searchParams.get('class'))?.id ?? null
  const className = option?.classes.find((c) => c.id === classId)?.name

  const choose = (subjectId: string, nextClassId: string | null) =>
    setSearchParams(
      {
        subject: subjectId,
        ...(nextClassId ? { class: nextClassId } : {}),
      },
      { replace: true },
    )

  const back =
    classId && option
      ? {
          to: `/${area}/classes/${classId}?tab=gradebook&subject=${option.subject.id}`,
          label: `Gradebook of ${className}`,
        }
      : area === 'admin'
        ? { to: '/admin/grades', label: 'Grades' }
        : { to: '/teacher/classes', label: 'My classes' }

  return (
    <>
      <BackLink to={back.to} label={back.label} />
      <PageHeader
        title="Import grades from Excel"
        description="For one class or all of them at once. Nothing is saved until you confirm."
      />
      {!option ? (
        <Card>
          <EmptyState
            title="No subjects to grade"
            description="You can import grades once you teach a subject in a class."
          />
        </Card>
      ) : (
        <ImportFlow
          // Choosing another subject or class starts over.
          key={`${option.subject.id}:${classId ?? ''}`}
          options={options.data}
          option={option}
          classId={classId}
          onChoose={choose}
          gradebookPath={back.to}
        />
      )}
    </>
  )
}

function ImportFlow({
  options,
  option,
  classId,
  onChoose,
  gradebookPath,
}: {
  options: GradeImportOption[]
  option: GradeImportOption
  classId: string | null
  onChoose: (subjectId: string, classId: string | null) => void
  gradebookPath: string
}) {
  const navigate = useNavigate()
  const subjectId = option.subject.id
  const importGrades = useImportGrades()
  const save = useSaveImportedGrades()

  const fileInput = useRef<HTMLInputElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState<GradeImportResult | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [date, setDate] = useState(todayIso())
  const { context, canReplace } = useReviewContext(
    result?.classes.map((c) => c.id) ?? [],
    subjectId,
    date,
  )

  const classes = classId
    ? option.classes.filter((c) => c.id === classId)
    : option.classes
  const classNames = classes.map((c) => c.name).join(', ')

  const download = async () => {
    setDownloading(true)
    try {
      await downloadTemplate(subjectId, classId)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  const upload = (file: File | undefined) => {
    if (!file) return
    importGrades.mutate(
      { subjectId, classId, file },
      {
        onSuccess: (data) => {
          setResult(data)
          setRows(data.rows.map(toImportRow))
          if (data.rows.length === 0) {
            toast.info('No grades found in the file.')
          }
        },
      },
    )
  }

  const startOver = () => {
    setResult(null)
    setRows([])
  }

  const grades = gradesToSave(rows, context)
  const submit = () => {
    if (!grades) return
    save.mutate(
      { subjectId, date, grades },
      {
        onSuccess: ({ count, replaced }) => {
          const classCount = new Set(
            rows
              .filter((r) => r.include)
              .map(
                (r) =>
                  result?.students.find((s) => s.id === r.studentId)?.class.id,
              ),
          ).size
          toast.success(
            `${count} ${count === 1 ? 'grade' : 'grades'} saved${
              classCount > 1 ? ` in ${classCount} classes` : ''
            }${replaced ? ` (${replaced} replaced)` : ''}`,
          )
          if (classId) void navigate(gradebookPath)
          else startOver()
        },
      },
    )
  }

  if (!result) {
    return (
      <Card className="gap-0 py-0">
        <SectionHeader title="1. Fill in the template and upload it" />
        <div className="border-b p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-subject">Subject</Label>
              <Select
                value={subjectId}
                onValueChange={(value) => onChoose(value, null)}
              >
                <SelectTrigger id="import-subject" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.subject.id} value={o.subject.id}>
                      {o.subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-class">Classes</Label>
              <Select
                value={classId ?? ALL_CLASSES}
                onValueChange={(value) =>
                  onChoose(subjectId, value === ALL_CLASSES ? null : value)
                }
              >
                <SelectTrigger id="import-class" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CLASSES}>
                    {option.classes.length === 1
                      ? `All classes (${option.classes[0]!.name})`
                      : `All ${option.classes.length} classes`}
                  </SelectItem>
                  {option.classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="grid gap-6 p-4 md:grid-cols-2">
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm">
              The template lists the students of {classNames}: class,
              registration number (nr. matricol) and name. Type the grades
              (1–10) and, if you want, the date of each one.
            </p>
            <Button
              variant="outline"
              onClick={() => void download()}
              disabled={downloading}
            >
              <Download aria-hidden /> Download template (.xlsx)
            </Button>
          </div>
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm">
              Then upload it. Your own sheet or a .csv works too: it needs a
              “Grade” column and the reg. no. or the class and name of each
              student.
            </p>
            <SubmitButton
              type="button"
              pending={importGrades.isPending}
              onClick={() => fileInput.current?.click()}
            >
              <FileSpreadsheet aria-hidden /> Upload the file
            </SubmitButton>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              hidden
              onChange={(event) => {
                upload(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>
        </div>
      </Card>
    )
  }

  const included = rows.filter((r) => r.include).length
  return (
    <Card className="gap-0 py-0">
      <SectionHeader
        title={`2. Check the grades · ${result.subject.name}, ${result.classes.map((c) => c.name).join(', ')}`}
        action={
          <span className="text-muted-foreground text-sm">
            {result.fileName} · {included} of {rows.length} selected
            {result.skippedRows > 0 &&
              ` · ${result.skippedRows} without a grade`}
          </span>
        }
      />
      <ReviewTable
        rows={rows}
        students={result.students}
        subjectName={result.subject.name}
        context={context}
        canReplace={canReplace}
        sourceHeader="Row"
        renderSource={(row) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            Row {row.source.rowNumber}
          </span>
        )}
        renderRead={(row) => {
          const read = row.source
          const details = [
            read.classRead,
            read.registrationNumberRead && read.studentNameRead
              ? `no. ${read.registrationNumberRead}`
              : null,
            `grade ${read.gradeRead ?? '—'}`,
            read.date ? formatDate(read.date) : null,
          ].filter(Boolean)
          return (
            <div className="flex flex-col gap-1 text-sm">
              <p>
                <span className="font-medium">
                  {read.studentNameRead ??
                    (read.registrationNumberRead
                      ? `Reg. no. ${read.registrationNumberRead}`
                      : 'No name')}
                </span>
                <span className="text-muted-foreground">
                  {' · '}
                  {details.join(' · ')}
                </span>
              </p>
              {read.note && (
                <p className="text-muted-foreground text-xs">{read.note}</p>
              )}
            </div>
          )
        }}
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
          <Label htmlFor="grades-date">Date for rows without one</Label>
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
            disabled={save.isPending}
          >
            <RotateCcw aria-hidden /> Upload another file
          </Button>
          <SubmitButton
            type="button"
            pending={save.isPending}
            disabled={!grades || !date}
            onClick={submit}
          >
            <Save aria-hidden /> Save {grades ? `${grades.length} ` : ''}
            {grades?.length === 1 ? 'grade' : 'grades'}
          </SubmitButton>
        </div>
      </div>
    </Card>
  )
}
