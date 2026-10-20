import { AlertTriangle } from 'lucide-react'
import { DataTable, type Column } from '@/components/data-table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { fullName } from '@/lib/format'
import type { Schemas } from '@/api/client'
import { AverageCell, GradeChip } from './grade-badges'

type SubjectGrades = Schemas['SubjectGradesDto']

const columns: Column<SubjectGrades>[] = [
  {
    header: 'Subject',
    cell: (row) => (
      <div>
        <div className="font-medium">{row.subject.name}</div>
        <div className="text-muted-foreground text-xs">
          {row.teacher ? fullName(row.teacher) : 'No teacher assigned'}
        </div>
      </div>
    ),
  },
  {
    header: 'Grades',
    className: 'min-w-44',
    cell: (row) =>
      row.grades.length === 0 ? (
        <span className="text-muted-foreground text-sm">No grades yet</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {row.grades.map((grade) => (
            <GradeChip key={grade.id} grade={grade} />
          ))}
        </div>
      ),
  },
  {
    header: 'Average',
    className: 'w-40',
    cell: (row) => (
      <div className="flex items-center gap-2">
        <AverageCell
          average={row.average}
          roundedAverage={row.roundedAverage}
        />
        {row.hasMinimumGrades === false && (
          <MissingGradesHint
            count={row.grades.length}
            minimum={row.minimumGrades}
          />
        )}
      </div>
    ),
  },
]

export function MissingGradesHint({
  count,
  minimum,
}: {
  count: number
  minimum: number | null
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AlertTriangle
          className="size-4 text-amber-600"
          aria-label="Not enough grades"
          tabIndex={0}
        />
      </TooltipTrigger>
      <TooltipContent>
        {count} of at least {minimum ?? '?'} grades needed for the term
      </TooltipContent>
    </Tooltip>
  )
}

/** Grades per subject with averages, as on a Romanian report card. */
export function ReportCardTable({
  report,
  isLoading,
  error,
  onRetry,
}: {
  report: Schemas['StudentGradesReportDto'] | undefined
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
}) {
  return (
    <DataTable
      columns={columns}
      rows={report?.subjects}
      rowKey={(row) => row.subject.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No subjects yet"
      emptyDescription="Subjects appear here once the class has teaching assignments."
    />
  )
}
