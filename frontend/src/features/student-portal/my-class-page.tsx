import { BookOpen, Home, School, Users } from 'lucide-react'
import { DataTable, type Column } from '@/components/data-table'
import { ClassTile } from '@/components/class-tile'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states'
import { Card } from '@/components/ui/card'
import type { ClassSubject } from '@/features/classes/api'
import { SubjectIcon } from '@/features/subjects/subject-icon'
import { fullName } from '@/lib/format'
import { useMyClass } from './use-my-class'

const subjectColumns: Column<ClassSubject>[] = [
  {
    header: 'Subject',
    cell: (s) => (
      <div className="flex items-center gap-3">
        <SubjectIcon subject={s.subject} />
        <div className="min-w-0">
          <div className="font-medium">{s.subject.name}</div>
          {/* Narrow: the teacher under the subject. */}
          <div className="text-muted-foreground text-xs @md:hidden">
            {s.teacher ? fullName(s.teacher) : 'Not assigned yet'}
          </div>
        </div>
      </div>
    ),
  },
  {
    header: 'Teacher',
    className: 'hidden @md:table-cell',
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
  const { classId, isPending, schoolClass } = useMyClass()

  if (isPending) return <LoadingBlock />
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
        leading={<ClassTile name={c.name} />}
        title={`Class ${c.name}`}
        description={`Your class in ${c.schoolYear.name}, its subjects and teachers.`}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Homeroom teacher"
          value={c.homeroomTeacher ? fullName(c.homeroomTeacher) : '—'}
          icon={Home}
          tone="amber"
          className="sm:col-span-2 xl:col-span-1"
        />
        <StatCard
          label="Students"
          value={c.studentCount}
          icon={Users}
          tone="violet"
        />
        <StatCard
          label="Subjects"
          value={c.subjects.length}
          icon={BookOpen}
          tone="sky"
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
