import {
  AlertTriangle,
  ClipboardList,
  Hourglass,
  TrendingUp,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { Card } from '@/components/ui/card'
import { useMyReport } from '@/features/grades/api'
import { ReportCardSection } from '@/features/grades/report-card-section'
import { SubjectAverages } from '@/features/grades/subject-averages'

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
          value={report.data?.overallAverage ?? '—'}
          decimals={2}
          icon={TrendingUp}
          tone="emerald"
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
          icon={ClipboardList}
          tone="sky"
          isLoading={report.isPending}
        />
        <StatCard
          label="Not enough grades"
          value={belowMinimum}
          icon={Hourglass}
          tone={belowMinimum > 0 ? 'amber' : 'emerald'}
          hint="Subjects below the term minimum"
          isLoading={report.isPending}
        />
        <StatCard
          label="Failing subjects"
          value={failing}
          icon={AlertTriangle}
          tone={failing > 0 ? 'rose' : 'emerald'}
          hint="Average below 5"
          isLoading={report.isPending}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ReportCardSection
          className="xl:col-span-2"
          student="me"
          report={report.data}
          isLoading={report.isPending}
          error={report.error}
          onRetry={() => void report.refetch()}
        />
        <Card className="gap-0 self-start py-0">
          <SectionHeader title="Average by subject" />
          {report.data && <SubjectAverages subjects={report.data.subjects} />}
        </Card>
      </div>
    </>
  )
}
