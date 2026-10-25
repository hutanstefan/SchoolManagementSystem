import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { DataTable, type Column } from '@/components/data-table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { fullName } from '@/lib/format'
import type { Schemas } from '@/api/client'
import { AverageCell, GradeChip } from './grade-badges'
import { SubjectIcon } from '@/features/subjects/subject-icon'
import { AbsenceCountCell } from '@/features/absences/absence-count'
import {
  StudentAbsencesDialog,
  type StudentAbsencesTarget,
} from '@/features/absences/student-absences-dialog'

type SubjectGrades = Schemas['SubjectGradesDto']
type Report = Schemas['StudentGradesReportDto']

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
  report: Report | undefined
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
}) {
  const [absencesOf, setAbsencesOf] = useState<StudentAbsencesTarget | null>(
    null,
  )
  const averageOf = (row: SubjectGrades) => (
    <div className="flex items-center gap-2">
      <AverageCell average={row.average} roundedAverage={row.roundedAverage} />
      {row.hasMinimumGrades === false && (
        <MissingGradesHint
          count={row.grades.length}
          minimum={row.minimumGrades}
        />
      )}
    </div>
  )
  const absenceCell = (row: SubjectGrades) =>
    report && (
      <AbsenceCountCell
        count={row.absences}
        maxAbsences={row.maxAbsences}
        label={`Absences in ${row.subject.name}`}
        onClick={() =>
          setAbsencesOf({
            student: { id: report.student.id, name: fullName(report.student) },
            subject: row.subject,
            schoolYearId: report.period.schoolYear.id,
            semester: report.period.semester,
          })
        }
      />
    )

  // Narrow: the average and absences go under the subject's name.
  const columns: Column<SubjectGrades>[] = [
    {
      header: 'Subject',
      className: 'whitespace-normal',
      cell: (row) => (
        <div className="flex items-start gap-3">
          <SubjectIcon subject={row.subject} className="hidden @md:flex" />
          <div className="min-w-0">
            <div className="font-medium">{row.subject.name}</div>
            <div className="text-muted-foreground text-xs">
              {row.teacher ? fullName(row.teacher) : 'No teacher assigned'}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 @xl:hidden">
              {averageOf(row)}
              {absenceCell(row)}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Grades',
      className: 'min-w-28 @xl:min-w-44',
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
      className: 'hidden w-40 @xl:table-cell',
      cell: averageOf,
    },
    {
      header: 'Absences',
      className: 'hidden w-32 @xl:table-cell',
      cell: absenceCell,
    },
  ]
  return (
    <>
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
      <StudentAbsencesDialog
        target={absencesOf}
        onClose={() => setAbsencesOf(null)}
      />
    </>
  )
}
