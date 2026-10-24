import {
  ArrowRight,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  Eye,
  Flag,
  Lock,
  School,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { ErrorState, LoadingBlock } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePeriod } from '@/periods/period-context'
import { useEndSemester, useSchoolYears, type SchoolYearSummary } from './api'

type Step = 'done' | 'current' | 'next'

/** Semester 1 → semester 2 → closing: where the open year is. */
function YearSteps({ year }: { year: SchoolYearSummary }) {
  const steps: { label: string; detail: string; state: Step }[] = [
    {
      label: 'Semester 1',
      detail: year.semester1EndedAt
        ? `Ended ${formatDate(year.semester1EndedAt)}`
        : 'In progress',
      state: year.currentSemester === 1 ? 'current' : 'done',
    },
    {
      label: 'Semester 2',
      detail: year.currentSemester === 2 ? 'In progress' : 'Not started',
      state: year.currentSemester === 2 ? 'current' : 'next',
    },
    {
      label: 'Close the year',
      detail: 'Results, re-exams, promotion',
      state: 'next',
    },
  ]
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.label}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl border p-3',
            step.state === 'current' &&
              'border-primary/40 bg-primary/5 ring-primary/10 ring-4',
            step.state === 'next' && 'opacity-70',
          )}
        >
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
              step.state === 'done' &&
                'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
              step.state === 'current' && 'bg-primary text-primary-foreground',
              step.state === 'next' && 'bg-muted text-muted-foreground',
            )}
          >
            {step.state === 'done' ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : (
              index + 1
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{step.label}</p>
            <p className="text-muted-foreground truncate text-xs">
              {step.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function OpenYearCard({ year }: { year: SchoolYearSummary }) {
  const endSemester = useEndSemester()
  const period = usePeriod()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <Card className="relative mb-6 gap-5 overflow-hidden p-6">
      <div
        aria-hidden
        className="bg-brand pointer-events-none absolute -top-24 -right-24 size-64 rounded-full opacity-10 blur-3xl"
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="bg-brand shadow-lifted flex size-14 items-center justify-center rounded-2xl text-white">
            <CalendarRange className="size-6" aria-hidden />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                {year.name}
              </h2>
              <Badge variant="success-soft">Open</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Semester {year.currentSemester} · {year.classCount} classes ·{' '}
              {year.studentCount} students
            </p>
          </div>
        </div>
        {year.currentSemester === 1 ? (
          <Button onClick={() => setConfirmOpen(true)}>
            <Flag aria-hidden /> End semester 1
          </Button>
        ) : (
          <Button asChild>
            <Link to="/admin/school-years/close">
              <CalendarCheck aria-hidden /> Close the year
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
      </div>
      <YearSteps year={year} />
      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {year.currentSemester === 1
          ? 'Ending a semester locks its grades for teachers; you can still correct them. New grades then go to semester 2.'
          : "Closing the year works out every student's annual averages, takes re-exam grades, and opens the next year with the promoted students."}
      </p>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`End semester 1 of ${year.name}?`}
        description="Teachers can no longer add or change semester 1 grades (you still can), and every new grade goes to semester 2. This can't be undone."
        confirmLabel="End semester 1"
        confirmVariant="default"
        pending={endSemester.isPending}
        onConfirm={() =>
          endSemester.mutate(undefined, {
            onSuccess: () => {
              setConfirmOpen(false)
              period.reset()
            },
          })
        }
      />
    </Card>
  )
}

function Outcome({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className?: string
}) {
  return (
    <div className="text-center">
      <p className={cn('text-lg font-semibold tabular-nums', className)}>
        {value}
      </p>
      <p className="text-muted-foreground text-[11px]">{label}</p>
    </div>
  )
}

function ArchivedYear({ year }: { year: SchoolYearSummary }) {
  const period = usePeriod()
  const navigate = useNavigate()
  const outcomes = year.outcomes
  return (
    <li className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Lock className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-medium">{year.name}</p>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
            <span className="inline-flex items-center gap-1">
              <School className="size-3" aria-hidden />
              {year.classCount} classes
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" aria-hidden />
              {year.studentCount} students
            </span>
            {year.closedAt && <span>Closed {formatDate(year.closedAt)}</span>}
          </p>
        </div>
      </div>
      {outcomes && (
        <div className="bg-muted/40 grid grid-cols-3 gap-4 rounded-lg px-4 py-2">
          <Outcome
            value={outcomes.promoted}
            label="Promoted"
            className="text-emerald-600 dark:text-emerald-400"
          />
          <Outcome
            value={outcomes.graduated}
            label="Graduated"
            className="text-primary"
          />
          <Outcome
            value={outcomes.repeating}
            label="Repeating"
            className={outcomes.repeating > 0 ? 'text-destructive' : undefined}
          />
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          period.setYear(year.id)
          void navigate('/admin')
        }}
      >
        <Eye aria-hidden /> View this year
      </Button>
    </li>
  )
}

/** The open year's progress (ending a semester, closing) and the archive. */
export function SchoolYearsPage() {
  const years = useSchoolYears()

  if (years.isPending) return <LoadingBlock />
  if (years.error) {
    return (
      <ErrorState error={years.error} onRetry={() => void years.refetch()} />
    )
  }

  const open = years.data.find((y) => y.status === 'ACTIVE')
  const archive = years.data.filter((y) => y.status === 'CLOSED')

  return (
    <>
      <PageHeader
        title="School years"
        description="Each year has two semesters. At the end of the year, students move up a grade into new classes."
      />
      {open && <OpenYearCard year={open} />}
      <Card className="gap-0 py-0">
        <SectionHeader
          title="Archive"
          description="Closed years can be viewed in full, by everyone who took part, but not changed."
        />
        {archive.length === 0 ? (
          <p className="text-muted-foreground px-5 py-8 text-center text-sm">
            No closed years yet.
          </p>
        ) : (
          <ul className="divide-y">
            {archive.map((year) => (
              <ArchivedYear key={year.id} year={year} />
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
