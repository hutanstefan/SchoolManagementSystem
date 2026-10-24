import {
  BookOpen,
  Cake,
  GraduationCap,
  History,
  Pencil,
  School,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackLink } from '@/components/back-link'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { PersonAvatar } from '@/components/person-avatar'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useStudentReport } from '@/features/grades/api'
import { ReportCardSection } from '@/features/grades/report-card-section'
import { OutcomeBadge } from '@/features/school-years/outcome-badge'
import { usePeriod } from '@/periods/period-context'
import { formatDate, fullName } from '@/lib/format'
import { useDeleteStudent, useStudent, type StudentDetail } from './api'
import { StudentFormDialog } from './student-form-dialog'

export function StudentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { isArchived } = usePeriod()
  const student = useStudent(id)
  const report = useStudentReport(id)
  const remove = useDeleteStudent()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (student.isPending) return <LoadingBlock />
  if (student.error) {
    return (
      <ErrorState
        error={student.error}
        onRetry={() => void student.refetch()}
      />
    )
  }

  const s = student.data
  const graded = report.data?.subjects.filter((row) => row.grades.length > 0)

  return (
    <>
      <BackLink to="/admin/students" label="All students" />
      <PageHeader
        leading={
          <PersonAvatar person={s} className="size-14 rounded-2xl text-lg" />
        }
        title={fullName(s)}
        description={`${s.email} · Reg. no. ${s.registrationNumber}`}
        actions={
          // A closed year shows the student as they were: no changes there.
          !isArchived && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden /> Edit
              </Button>
              <Button variant="outline" onClick={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden /> Delete
              </Button>
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Class"
          icon={School}
          tone="indigo"
          value={
            s.class ? (
              <Link
                to={`/admin/classes/${s.class.id}`}
                className="hover:underline"
              >
                {s.class.name}
              </Link>
            ) : s.graduatedIn ? (
              <Badge variant="primary-soft">
                <GraduationCap aria-hidden /> Graduated
              </Badge>
            ) : (
              <Badge variant="outline">Not assigned</Badge>
            )
          }
          hint={s.graduatedIn ? `In ${s.graduatedIn}` : undefined}
        />
        <StatCard
          label="Date of birth"
          value={formatDate(s.dateOfBirth)}
          icon={Cake}
          tone="sky"
        />
        <StatCard
          label="General average"
          value={report.data?.overallAverage ?? '—'}
          decimals={2}
          icon={TrendingUp}
          tone="emerald"
          hint={
            report.data?.overallAverage === null
              ? 'Shown once every subject has grades'
              : undefined
          }
          isLoading={report.isPending}
        />
        <StatCard
          label="Subjects with grades"
          icon={BookOpen}
          tone="violet"
          value={
            report.data
              ? `${graded?.length} / ${report.data.subjects.length}`
              : '—'
          }
          isLoading={report.isPending}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {!s.class && s.history.length > 0 ? (
          <NotEnrolledThatYear student={s} />
        ) : (
          <ReportCardSection
            className="xl:col-span-2"
            student={s.id}
            report={report.data}
            isLoading={report.isPending}
            error={report.error}
            onRetry={() => void report.refetch()}
          />
        )}
        <SchoolHistory student={s} />
      </div>

      <StudentFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        student={s}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${fullName(s)}?`}
        description="The account and all of the student's grades are deleted. This cannot be undone."
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(s.id, {
            onSuccess: () =>
              void navigate('/admin/students', { replace: true }),
          })
        }
      />
    </>
  )
}

/** A graduate (or a student who left) seen from a year they weren't in. */
function NotEnrolledThatYear({ student }: { student: StudentDetail }) {
  const period = usePeriod()
  const last = student.history[0]!
  return (
    <Card className="xl:col-span-2">
      <EmptyState
        icon={student.graduatedIn ? GraduationCap : History}
        title={
          student.graduatedIn
            ? `Graduated in ${student.graduatedIn}`
            : `Not in a class in ${period.year?.name ?? 'this year'}`
        }
        description={`Their last report card is from ${last.schoolYear.name}, in class ${last.class.name}.`}
        action={
          <Button
            variant="outline"
            onClick={() => period.setYear(last.schoolYear.id)}
          >
            View {last.schoolYear.name}
          </Button>
        }
      />
    </Card>
  )
}

/** The student's classes year by year, and how each year ended. */
function SchoolHistory({ student }: { student: StudentDetail }) {
  return (
    <Card className="gap-0 self-start py-0">
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            <History className="text-muted-foreground size-4" aria-hidden />
            School history
          </span>
        }
      />
      {student.history.length === 0 ? (
        <p className="text-muted-foreground px-5 py-8 text-center text-sm">
          Not enrolled in any class yet.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-4 p-5">
          {student.history.map((entry, index) => (
            <li key={entry.schoolYear.id} className="relative flex gap-3">
              {index < student.history.length - 1 && (
                <span
                  aria-hidden
                  className="bg-border absolute top-8 bottom-[-1rem] left-[15px] w-px"
                />
              )}
              <span className="bg-brand flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold text-white">
                {entry.class.name}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  <Link
                    to={`/admin/classes/${entry.class.id}`}
                    className="hover:underline"
                  >
                    Class {entry.class.name}
                  </Link>
                </p>
                <p className="text-muted-foreground text-xs">
                  {entry.schoolYear.name}
                </p>
              </div>
              {entry.outcome ? (
                <OutcomeBadge outcome={entry.outcome} />
              ) : (
                <Badge variant="outline">In progress</Badge>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
