import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackLink } from '@/components/back-link'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { ErrorState, LoadingBlock } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useStudentReport } from '@/features/grades/api'
import { ReportCardTable } from '@/features/grades/report-card'
import { formatAverage, formatDate, fullName } from '@/lib/format'
import { useDeleteStudent, useStudent } from './api'
import { StudentFormDialog } from './student-form-dialog'

export function StudentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
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
        title={fullName(s)}
        description={s.email}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden /> Edit
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 aria-hidden /> Delete
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Class"
          value={
            s.class ? (
              <Link
                to={`/admin/classes/${s.class.id}`}
                className="hover:underline"
              >
                {s.class.name}
              </Link>
            ) : (
              <Badge variant="outline">Not assigned</Badge>
            )
          }
        />
        <StatCard label="Date of birth" value={formatDate(s.dateOfBirth)} />
        <StatCard
          label="General average"
          value={formatAverage(report.data?.overallAverage)}
          hint={
            report.data?.overallAverage === null
              ? 'Shown once every subject has grades'
              : undefined
          }
          isLoading={report.isPending}
        />
        <StatCard
          label="Subjects with grades"
          value={
            report.data
              ? `${graded?.length} / ${report.data.subjects.length}`
              : '—'
          }
          isLoading={report.isPending}
        />
      </div>

      <Card className="gap-0 py-0">
        <SectionHeader title="Report card" />
        <ReportCardTable
          report={report.data}
          isLoading={report.isPending}
          error={report.error}
          onRetry={() => void report.refetch()}
        />
      </Card>

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
