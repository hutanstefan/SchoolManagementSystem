import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  TrendingUp,
} from 'lucide-react'
import { useParams } from 'react-router'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { PersonAvatar } from '@/components/person-avatar'
import { StatCard } from '@/components/stat-card'
import { ErrorState, LoadingBlock } from '@/components/states'
import { useStudentReport } from '@/features/grades/api'
import { ReportCardSection } from '@/features/grades/report-card-section'
import { fullName } from '@/lib/format'

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
        leading={
          <PersonAvatar
            person={r.student}
            className="size-14 rounded-2xl text-lg"
          />
        }
        title={fullName(r.student)}
        description={`${r.class ? `Class ${r.class.name}` : 'Not in a class'} · Reg. no. ${r.registrationNumber}`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="General average"
          value={r.overallAverage ?? '—'}
          decimals={2}
          icon={TrendingUp}
          tone="emerald"
          hint={
            r.overallAverage === null
              ? 'Shown once every subject has grades'
              : undefined
          }
        />
        <StatCard
          label="Grades"
          value={gradeCount}
          icon={ClipboardList}
          tone="sky"
        />
        <StatCard
          label="Subjects with grades"
          icon={BookOpen}
          tone="violet"
          value={`${graded} / ${r.subjects.length}`}
        />
        <StatCard
          label="Not enough grades"
          value={belowMinimum}
          icon={AlertTriangle}
          tone={belowMinimum > 0 ? 'amber' : 'emerald'}
          hint="Subjects below the term minimum"
        />
      </div>

      <ReportCardSection student={id} report={r} />
    </>
  )
}
