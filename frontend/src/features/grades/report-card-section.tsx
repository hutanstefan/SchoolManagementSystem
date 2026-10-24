import { useState } from 'react'
import { Segmented } from '@/components/segmented'
import { SectionHeader } from '@/components/section-header'
import { Card } from '@/components/ui/card'
import { OutcomeBadge } from '@/features/school-years/outcome-badge'
import { cn } from '@/lib/utils'
import { usePeriod } from '@/periods/period-context'
import { type StudentReport, useMyYear, useStudentYear } from './api'
import { ReportCardTable } from './report-card'
import { YearReportTable } from './year-report'

/**
 * The report card of the picked semester, or of the whole year (both
 * semesters, annual averages and how the year ended).
 */
export function ReportCardSection({
  student,
  report,
  isLoading,
  error,
  onRetry,
  className,
}: {
  /** The student's id, or "me" for the signed-in student. */
  student: string
  report: StudentReport | undefined
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
  className?: string
}) {
  const { semester } = usePeriod()
  const [view, setView] = useState<'semester' | 'year'>('semester')
  const isMe = student === 'me'
  const mine = useMyYear(isMe && view === 'year')
  const theirs = useStudentYear(student, !isMe && view === 'year')
  const year = isMe ? mine : theirs
  const shown = report?.period.semester ?? semester

  return (
    <Card className={cn('gap-0 py-0', className)}>
      <SectionHeader
        title="Report card"
        description={
          view === 'year'
            ? report?.period.schoolYear.name
            : report && `${report.period.schoolYear.name} · Semester ${shown}`
        }
        action={
          <div className="flex items-center gap-2">
            {view === 'year' && year.data?.outcome && (
              <OutcomeBadge outcome={year.data.outcome} />
            )}
            <Segmented
              label="Report"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'semester', label: `Semester ${shown}` },
                { value: 'year', label: 'Whole year' },
              ]}
            />
          </div>
        }
      />
      {view === 'semester' ? (
        <ReportCardTable
          report={report}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
        />
      ) : (
        <YearReportTable
          report={year.data}
          isLoading={year.isPending}
          error={year.error}
          onRetry={() => void year.refetch()}
        />
      )}
    </Card>
  )
}
