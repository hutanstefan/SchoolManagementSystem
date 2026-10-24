import { CheckCircle2, XCircle } from 'lucide-react'
import { DataTable, type Column } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SubjectIcon } from '@/features/subjects/subject-icon'
import { formatAverage } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StudentYearReport, SubjectYear } from './api'
import { gradeTone } from './grade-tone'

function GradeBox({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        'inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-sm font-semibold tabular-nums',
        gradeTone(value),
      )}
    >
      {value}
    </span>
  )
}

const columns: Column<SubjectYear>[] = [
  {
    header: 'Subject',
    cell: (row) => (
      <div className="flex items-center gap-3">
        <SubjectIcon subject={row.subject} />
        <span className="font-medium">{row.subject.name}</span>
      </div>
    ),
  },
  {
    header: 'Sem. 1',
    className: 'text-center',
    cell: (row) => <GradeBox value={row.semester1} />,
  },
  {
    header: 'Sem. 2',
    className: 'text-center',
    cell: (row) => <GradeBox value={row.semester2} />,
  },
  {
    header: 'Annual',
    className: 'text-center',
    cell: (row) => (
      <span className="tabular-nums">{formatAverage(row.annual)}</span>
    ),
  },
  {
    header: 'Re-exam',
    className: 'hidden text-center sm:table-cell',
    cell: (row) => <GradeBox value={row.reexamGrade} />,
  },
  {
    header: 'Final',
    className: 'text-center',
    cell: (row) =>
      row.final === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span
          className={cn(
            'font-semibold tabular-nums',
            !row.passed && 'text-destructive',
          )}
        >
          {formatAverage(row.final)}
        </span>
      ),
  },
  {
    header: <span className="sr-only">Result</span>,
    className: 'w-10',
    cell: (row) =>
      row.final === null ? null : (
        <Tooltip>
          <TooltipTrigger asChild>
            {row.passed ? (
              <CheckCircle2
                className="size-4 text-emerald-600"
                aria-label="Passed"
                tabIndex={0}
              />
            ) : (
              <XCircle
                className="text-destructive size-4"
                aria-label="Failed"
                tabIndex={0}
              />
            )}
          </TooltipTrigger>
          <TooltipContent>
            {row.passed ? 'Passed' : 'Failed: final average under 5'}
          </TooltipContent>
        </Tooltip>
      ),
  },
]

/**
 * The whole year per subject, as on the annual report: both semester
 * averages, their mean, a re-exam if there was one, and the final average.
 */
export function YearReportTable({
  report,
  isLoading,
  error,
  onRetry,
}: {
  report: StudentYearReport | undefined
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
}) {
  const failed = report?.subjects.filter(
    (s) => s.final !== null && !s.passed,
  ).length
  return (
    <>
      <DataTable
        columns={columns}
        rows={report?.subjects}
        rowKey={(row) => row.subject.id}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        emptyTitle="No subjects this year"
      />
      {report && (
        <div className="bg-muted/30 flex flex-wrap items-center gap-x-6 gap-y-2 border-t px-5 py-3 text-sm">
          <span>
            <span className="text-muted-foreground">Annual average </span>
            <span className="font-semibold tabular-nums">
              {formatAverage(report.generalAverage)}
            </span>
          </span>
          {failed !== undefined && failed > 0 && (
            <Badge variant="destructive-soft">
              {failed} failed {failed === 1 ? 'subject' : 'subjects'}
            </Badge>
          )}
          <span className="text-muted-foreground text-xs">
            Annual = mean of the two semester averages; a re-exam grade replaces
            it.
          </span>
        </div>
      )}
    </>
  )
}
