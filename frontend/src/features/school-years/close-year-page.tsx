import {
  ArrowRight,
  Award,
  CalendarCheck,
  GraduationCap,
  Hourglass,
  RotateCcw,
  Save,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/back-link'
import { ClassTile } from '@/components/class-tile'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { PersonAvatar } from '@/components/person-avatar'
import { Segmented } from '@/components/segmented'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SubjectDot } from '@/features/subjects/subject-icon'
import { formatAverage, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePeriod } from '@/periods/period-context'
import {
  useCloseYear,
  useClosingPreview,
  useRemoveReexam,
  useSaveReexam,
  type ClosingClass,
  type ClosingStudent,
  type YearOutcome,
} from './api'
import {
  allowedOutcomes,
  canTakeReexams,
  countOutcomes,
  effectiveOutcome,
  needsAttention,
  type Decisions,
} from './closing'
import { OUTCOMES } from './outcomes'

type FailedSubject = ClosingStudent['failedSubjects'][number]

function SummaryTile({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon
  label: string
  value: number
  className: string
}) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          className,
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>
    </Card>
  )
}

/** The grade of a re-exam (corigență) in one failed subject. */
function ReexamInput({
  studentId,
  subject,
}: {
  studentId: string
  subject: FailedSubject
}) {
  const save = useSaveReexam()
  const remove = useRemoveReexam()
  const [value, setValue] = useState('')
  const grade = Number(value)
  const valid = Number.isInteger(grade) && grade >= 1 && grade <= 10

  return (
    <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <SubjectDot color={subject.subject.color} />
        <span className="truncate font-medium">{subject.subject.name}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          annual {formatAverage(subject.annual)}
        </span>
      </span>
      {subject.reexamGrade !== null ? (
        <span className="flex items-center gap-1">
          <Badge variant={subject.passed ? 'success-soft' : 'destructive-soft'}>
            Re-exam: {subject.reexamGrade}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Remove the re-exam grade in ${subject.subject.name}`}
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate({ studentId, subjectId: subject.subject.id })
            }
          >
            <X />
          </Button>
        </span>
      ) : (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid) return
            save.mutate(
              { studentId, subjectId: subject.subject.id, grade },
              { onSuccess: () => setValue('') },
            )
          }}
        >
          <Input
            type="number"
            min={1}
            max={10}
            step={1}
            inputMode="numeric"
            placeholder="Grade"
            aria-label={`Re-exam grade in ${subject.subject.name}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-8 w-20"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!valid || save.isPending}
          >
            <Save aria-hidden /> Save
          </Button>
        </form>
      )}
    </div>
  )
}

function StudentRow({
  student,
  schoolClass,
  decisions,
  onDecide,
}: {
  student: ClosingStudent
  schoolClass: ClosingClass
  decisions: Decisions
  onDecide: (outcome: YearOutcome | null) => void
}) {
  const outcome = effectiveOutcome(student, decisions)
  const overridden = decisions.has(student.id)
  const suggested = student.suggestedOutcome
  const failing = student.failedSubjects.filter((s) => !s.passed)

  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <PersonAvatar person={student} />
          <div className="min-w-0">
            <p className="truncate font-medium">{fullName(student)}</p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {student.registrationNumber} · Annual average{' '}
              <span className="text-foreground font-medium">
                {formatAverage(student.generalAverage)}
              </span>
            </p>
          </div>
        </div>
        {failing.length > 0 && !canTakeReexams(student) && (
          <Badge variant="destructive-soft">
            {failing.length} failed subjects
          </Badge>
        )}
        <div className="flex items-center gap-2">
          {overridden && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8"
              onClick={() => onDecide(null)}
            >
              Use suggestion
            </Button>
          )}
          <Select
            value={outcome ?? undefined}
            onValueChange={(value) => onDecide(value as YearOutcome)}
          >
            <SelectTrigger
              className={cn(
                'w-full @2xl:w-64',
                outcome === null &&
                  'border-amber-500/50 bg-amber-500/5 text-amber-700 dark:text-amber-300',
              )}
              aria-label={`Outcome for ${fullName(student)}`}
            >
              <SelectValue placeholder="Waiting for re-exams" />
            </SelectTrigger>
            <SelectContent>
              {allowedOutcomes(schoolClass).map((value) => {
                const Icon = OUTCOMES[value].icon
                return (
                  <SelectItem key={value} value={value}>
                    <Icon aria-hidden />
                    {OUTCOMES[value].label}
                    {value === suggested && (
                      <span className="text-muted-foreground text-xs">
                        · suggested
                      </span>
                    )}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
      {canTakeReexams(student) && (
        <div className="grid gap-2 @2xl:pl-12 @4xl:grid-cols-2">
          {student.failedSubjects.map((subject) => (
            <ReexamInput
              key={subject.subject.id}
              studentId={student.id}
              subject={subject}
            />
          ))}
        </div>
      )}
    </li>
  )
}

function ClassSection({
  schoolClass,
  decisions,
  onDecide,
  onlyAttention,
}: {
  schoolClass: ClosingClass
  decisions: Decisions
  onDecide: (studentId: string, outcome: YearOutcome | null) => void
  onlyAttention: boolean
}) {
  const students = onlyAttention
    ? schoolClass.students.filter((s) => needsAttention(s, decisions))
    : schoolClass.students
  if (students.length === 0) return null
  const pending = schoolClass.students.filter(
    (s) => effectiveOutcome(s, decisions) === null,
  ).length

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <ClassTile
          name={schoolClass.class.name}
          className="size-10 rounded-xl text-sm shadow-none"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            Class {schoolClass.class.name}
            <ArrowRight className="text-muted-foreground size-4" aria-hidden />
            {schoolClass.nextClassName ? (
              <span>{schoolClass.nextClassName}</span>
            ) : (
              <span className="text-primary inline-flex items-center gap-1">
                <GraduationCap className="size-4" aria-hidden /> Graduates
              </span>
            )}
          </p>
          <p className="text-muted-foreground text-xs">
            {schoolClass.students.length} students
          </p>
        </div>
        {pending > 0 && (
          <Badge variant="warning-soft">
            <Hourglass aria-hidden /> {pending} waiting
          </Badge>
        )}
      </div>
      {/* Laid out by its own width: the sidebar takes room on tablets. */}
      <ul className="@container divide-y">
        {students.map((student) => (
          <StudentRow
            key={student.id}
            student={student}
            schoolClass={schoolClass}
            decisions={decisions}
            onDecide={(outcome) => onDecide(student.id, outcome)}
          />
        ))}
      </ul>
    </Card>
  )
}

/**
 * Closing the open year: every student's result with what the rules suggest,
 * re-exam grades, the admin's last word, then the next year is opened.
 */
export function CloseYearPage() {
  const navigate = useNavigate()
  const period = usePeriod()
  // Only a year in its second semester can be closed. (Right after closing,
  // the open year is the new one: nothing to preview any more.)
  const canClose = period.activeYear?.currentSemester === 2
  const preview = useClosingPreview(canClose)
  const close = useCloseYear()
  const [decisions, setDecisions] = useState<Map<string, YearOutcome>>(
    () => new Map(),
  )
  const [createEntryClasses, setCreateEntryClasses] = useState(true)
  const [filter, setFilter] = useState<'attention' | 'all'>('attention')
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!canClose) {
    return (
      <>
        <BackLink to="/admin/school-years" label="School years" />
        <Card>
          <EmptyState
            icon={CalendarCheck}
            title="Not time to close the year yet"
            description="A school year can be closed during its second semester, once semester 1 has ended."
          />
        </Card>
      </>
    )
  }
  if (preview.isPending) return <LoadingBlock />
  if (preview.error) {
    return (
      <>
        <BackLink to="/admin/school-years" label="School years" />
        <ErrorState
          error={preview.error}
          onRetry={() => void preview.refetch()}
        />
      </>
    )
  }

  const { schoolYear, nextYearName, classes } = preview.data
  const counts = countOutcomes(classes, decisions)
  const attentionCount = classes
    .flatMap((c) => c.students)
    .filter((s) => needsAttention(s, decisions)).length

  const decide = (studentId: string, outcome: YearOutcome | null) =>
    setDecisions((current) => {
      const next = new Map(current)
      if (outcome === null) next.delete(studentId)
      else next.set(studentId, outcome)
      return next
    })

  const submit = async () => {
    const result = await close.mutateAsync({
      createEntryClasses,
      decisions: [...decisions].map(([studentId, outcome]) => ({
        studentId,
        outcome,
      })),
    })
    toast.success(
      `${result.closedYear.name} is closed. ${result.newYear.name} has started with ${result.classesCreated} classes.`,
    )
    period.reset()
    await navigate('/admin/school-years', { replace: true })
    void close.refreshAll()
  }

  return (
    <div className="pb-28">
      <BackLink to="/admin/school-years" label="School years" />
      <PageHeader
        title={`Close ${schoolYear.name}`}
        description={`Check each student's annual result, enter re-exam grades, then open ${nextYearName}. Classes move up a grade with their homeroom teacher, subjects and teachers.`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={Award}
          label="Move up a grade"
          value={counts.promoted}
          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
        />
        <SummaryTile
          icon={GraduationCap}
          label="Graduate"
          value={counts.graduated}
          className="bg-primary/10 text-primary"
        />
        <SummaryTile
          icon={Hourglass}
          label="Waiting for re-exams"
          value={counts.pending}
          className="bg-amber-500/10 text-amber-600 dark:text-amber-300"
        />
        <SummaryTile
          icon={RotateCcw}
          label="Repeat the year"
          value={counts.repeating}
          className="bg-destructive/10 text-destructive"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Romanian rules: the annual average of a subject is the mean of the two
          semester averages. Under 5 in one or two subjects means a re-exam; in
          three or more, repeating the year.
        </p>
        <Segmented
          label="Students shown"
          value={filter}
          onChange={setFilter}
          options={[
            {
              value: 'attention',
              label: `Needs attention (${attentionCount})`,
            },
            { value: 'all', label: 'Everyone' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-4">
        {classes.map((schoolClass) => (
          <ClassSection
            key={schoolClass.class.id}
            schoolClass={schoolClass}
            decisions={decisions}
            onDecide={decide}
            onlyAttention={filter === 'attention'}
          />
        ))}
        {filter === 'attention' && attentionCount === 0 && (
          <Card className="items-center gap-2 p-10 text-center">
            <Sparkles className="text-primary size-6" aria-hidden />
            <p className="font-medium">Everyone passed every subject</p>
            <p className="text-muted-foreground text-sm">
              Switch to “Everyone” to see each student.
            </p>
          </Card>
        )}
      </div>

      {/* In <body>: the page's enter animation would otherwise pin it to the page. */}
      {createPortal(
        <div className="bg-background/85 supports-[backdrop-filter]:bg-background/70 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-md lg:left-64">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center md:px-8">
            <div className="flex flex-1 items-start gap-2">
              <Checkbox
                id="entry-classes"
                checked={createEntryClasses}
                onCheckedChange={(checked) =>
                  setCreateEntryClasses(checked === true)
                }
                className="mt-0.5"
              />
              <Label
                htmlFor="entry-classes"
                className="flex-col items-start gap-0.5 font-normal"
              >
                <span className="font-medium">
                  Open new entry classes for incoming students
                </span>
                <span className="text-muted-foreground text-xs">
                  Same names and subjects as this year's first grade, teachers
                  to be assigned.
                </span>
              </Label>
            </div>
            {counts.pending > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {counts.pending} waiting for re-exams
              </p>
            )}
            <Button
              size="lg"
              disabled={counts.pending > 0 || close.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              <CalendarCheck aria-hidden /> Close {schoolYear.name}
            </Button>
          </div>
        </div>,
        document.body,
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Close ${schoolYear.name} and open ${nextYearName}?`}
        description={
          <>
            {counts.promoted} students move up a grade, {counts.graduated}{' '}
            graduate and {counts.repeating} repeat the year. {schoolYear.name}{' '}
            becomes read-only for everyone. This can't be undone.
          </>
        }
        confirmLabel={`Open ${nextYearName}`}
        confirmVariant="default"
        pending={close.isPending}
        onConfirm={() => void submit().catch(() => {})}
      />
    </div>
  )
}
