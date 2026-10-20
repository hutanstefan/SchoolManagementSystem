import { School } from 'lucide-react'
import { DataTable, type Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states'
import { Card } from '@/components/ui/card'
import type { ClassSubject } from '@/features/classes/api'
import { fullName } from '@/lib/format'
import { useMyClass } from './use-my-class'

const subjectColumns: Column<ClassSubject>[] = [
  {
    header: 'Subject',
    cell: (s) => <span className="font-medium">{s.subject.name}</span>,
  },
  {
    header: 'Teacher',
    cell: (s) =>
      s.teacher ? (
        fullName(s.teacher)
      ) : (
        <span className="text-muted-foreground">Not assigned yet</span>
      ),
  },
  {
    header: 'Hours / week',
    cell: (s) => s.hoursPerWeek,
    className: 'text-right tabular-nums',
  },
]

export function StudentClassPage() {
  const { classId, schoolClass } = useMyClass()

  if (!classId) {
    return (
      <>
        <PageHeader title="My class" />
        <Card>
          <EmptyState
            icon={School}
            title="You are not in a class yet"
            description="The school administrator will enroll you in a class."
          />
        </Card>
      </>
    )
  }
  if (schoolClass.isPending) return <LoadingBlock />
  if (schoolClass.error) {
    return (
      <ErrorState
        error={schoolClass.error}
        onRetry={() => void schoolClass.refetch()}
      />
    )
  }

  const c = schoolClass.data
  const hours = c.subjects.reduce((sum, s) => sum + s.hoursPerWeek, 0)

  return (
    <>
      <PageHeader
        title={`Class ${c.name}`}
        description="Your class, its subjects and teachers."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Homeroom teacher"
          value={c.homeroomTeacher ? fullName(c.homeroomTeacher) : '—'}
        />
        <StatCard label="Students" value={c.studentCount} />
        <StatCard
          label="Subjects"
          value={c.subjects.length}
          hint={`${hours} hours a week`}
        />
      </div>
      <Card className="gap-0 py-0">
        <SectionHeader title="Subjects and teachers" />
        <DataTable
          columns={subjectColumns}
          rows={c.subjects}
          rowKey={(s) => s.classSubjectId}
          emptyTitle="No subjects yet"
        />
      </Card>
    </>
  )
}
