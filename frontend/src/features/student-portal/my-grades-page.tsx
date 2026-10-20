import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { Card } from '@/components/ui/card'
import { useMyReport } from '@/features/grades/api'
import { ReportCardTable } from '@/features/grades/report-card'
import { SubjectAverages } from '@/features/grades/subject-averages'
import { formatAverage } from '@/lib/format'

export function MyGradesPage() {
  const report = useMyReport()
  const subjects = report.data?.subjects ?? []
  const gradeCount = subjects.reduce((sum, row) => sum + row.grades.length, 0)
  const belowMinimum = subjects.filter(
    (row) => row.hasMinimumGrades === false,
  ).length
  const failing = subjects.filter(
    (row) => row.roundedAverage !== null && row.roundedAverage < 5,
  ).length

  return (
    <>
      <PageHeader
        title="My grades"
        description="Your grades and averages in every subject."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="General average"
          value={formatAverage(report.data?.overallAverage)}
          hint={
            report.data?.overallAverage === null
              ? 'Shown once every subject has grades'
              : 'Mean of your subject averages'
          }
          isLoading={report.isPending}
        />
        <StatCard
          label="Grades"
          value={gradeCount}
          isLoading={report.isPending}
        />
        <StatCard
          label="Not enough grades"
          value={belowMinimum}
          hint="Subjects below the term minimum"
          isLoading={report.isPending}
        />
        <StatCard
          label="Failing subjects"
          value={failing}
          hint="Average below 5"
          isLoading={report.isPending}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="gap-0 py-0 xl:col-span-2">
          <SectionHeader title="Report card" />
          <ReportCardTable
            report={report.data}
            isLoading={report.isPending}
            error={report.error}
            onRetry={() => void report.refetch()}
          />
        </Card>
        <Card className="gap-0 self-start py-0">
          <SectionHeader title="Average by subject" />
          {report.data && <SubjectAverages subjects={report.data.subjects} />}
        </Card>
      </div>
    </>
  )
}
