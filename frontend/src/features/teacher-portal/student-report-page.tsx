import { useParams } from 'react-router'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { ErrorState, LoadingBlock } from '@/components/states'
import { Card } from '@/components/ui/card'
import { useStudentReport } from '@/features/grades/api'
import { ReportCardTable } from '@/features/grades/report-card'
import { formatAverage, fullName } from '@/lib/format'

/** A student's report card, as seen by a teacher of their class. */
export function StudentReportPage() {
  const { id = '' } = useParams()
  const report = useStudentReport(id)

  if (report.isPending) return <LoadingBlock />
  if (report.error) {
    return (
      <ErrorState error={report.error} onRetry={() => void report.refetch()} />
    )
  }

  const r = report.data
  const graded = r.subjects.filter((row) => row.grades.length > 0).length
  const gradeCount = r.subjects.reduce((sum, row) => sum + row.grades.length, 0)
  const belowMinimum = r.subjects.filter(
    (row) => row.hasMinimumGrades === false,
  ).length

  return (
    <>
      <BackLink
        to={
          r.class
            ? `/teacher/classes/${r.class.id}?tab=gradebook`
            : '/teacher/classes'
        }
        label={r.class ? `Class ${r.class.name}` : 'My classes'}
      />
      <PageHeader
        title={fullName(r.student)}
        description={r.class ? `Class ${r.class.name}` : 'Not in a class'}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="General average"
          value={formatAverage(r.overallAverage)}
          hint={
            r.overallAverage === null
              ? 'Shown once every subject has grades'
              : undefined
          }
        />
        <StatCard label="Grades" value={gradeCount} />
        <StatCard
          label="Subjects with grades"
          value={`${graded} / ${r.subjects.length}`}
        />
        <StatCard
          label="Not enough grades"
          value={belowMinimum}
          hint="Subjects below the term minimum"
        />
      </div>

      <Card className="gap-0 py-0">
        <SectionHeader title="Report card" />
        <ReportCardTable report={r} />
      </Card>
    </>
  )
}
