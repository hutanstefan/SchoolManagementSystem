import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { Schemas } from '@/api/client'
import { BackLink } from '@/components/back-link'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, type Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { ErrorState, LoadingBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useTeacherTimetable } from '@/features/timetable/api'
import { TimetableGrid } from '@/features/timetable/timetable-grid'
import { fullName } from '@/lib/format'
import { useDeleteTeacher, useTeacher } from './api'
import { TeacherFormDialog } from './teacher-form-dialog'

type Assignment = Schemas['TeachingAssignmentDto']

const assignmentColumns: Column<Assignment>[] = [
  {
    header: 'Class',
    cell: (a) => (
      <Link
        to={`/admin/classes/${a.class.id}?tab=subjects`}
        className="font-medium hover:underline"
      >
        {a.class.name}
      </Link>
    ),
  },
  { header: 'Subject', cell: (a) => a.subject.name },
  {
    header: 'Hours / week',
    cell: (a) => a.hoursPerWeek,
    className: 'text-right tabular-nums',
  },
]

export function TeacherDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const teacher = useTeacher(id)
  const timetable = useTeacherTimetable(id)
  const remove = useDeleteTeacher()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (teacher.isPending) return <LoadingBlock />
  if (teacher.error) {
    return (
      <ErrorState
        error={teacher.error}
        onRetry={() => void teacher.refetch()}
      />
    )
  }

  const t = teacher.data
  const hours = t.teaching.reduce((sum, a) => sum + a.hoursPerWeek, 0)
  const classCount = new Set(t.teaching.map((a) => a.class.id)).size

  return (
    <>
      <BackLink to="/admin/teachers" label="All teachers" />
      <PageHeader
        title={fullName(t)}
        description={t.email}
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

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Homeroom teacher of"
          value={
            t.homeroomClasses.length === 0
              ? '—'
              : t.homeroomClasses.map((c, index) => (
                  <span key={c.id}>
                    {index > 0 && ', '}
                    <Link
                      to={`/admin/classes/${c.id}`}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                  </span>
                ))
          }
        />
        <StatCard label="Classes taught" value={classCount} />
        <StatCard label="Hours per week" value={hours} />
      </div>

      <div className="grid gap-6">
        <Card className="gap-0 py-0">
          <SectionHeader title="Teaching assignments" />
          <DataTable
            columns={assignmentColumns}
            rows={t.teaching}
            rowKey={(a) => a.classSubjectId}
            emptyTitle="Not teaching any class yet"
            emptyDescription="Assign subjects from a class page, in the Subjects tab."
          />
        </Card>

        <Card className="gap-0 py-0">
          <SectionHeader title="Timetable" />
          <div className="p-2">
            {timetable.isPending ? (
              <LoadingBlock />
            ) : timetable.error ? (
              <ErrorState
                error={timetable.error}
                onRetry={() => void timetable.refetch()}
              />
            ) : (
              <TimetableGrid timetable={timetable.data} mode="teacher" />
            )}
          </div>
        </Card>
      </div>

      <TeacherFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        teacher={t}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${fullName(t)}?`}
        description="Their classes lose this homeroom teacher and their subjects become unassigned. The grades they gave are kept."
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(t.id, {
            onSuccess: () =>
              void navigate('/admin/teachers', { replace: true }),
          })
        }
      />
    </>
  )
}
