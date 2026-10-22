import { Link2, Pencil, Trash2, UserMinus } from 'lucide-react'
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
import { useUpdateClassSubject } from '@/features/classes/api'
import { useTeacherTimetable } from '@/features/timetable/api'
import { TimetableGrid } from '@/features/timetable/timetable-grid'
import { fullName } from '@/lib/format'
import { useDeleteTeacher, useTeacher } from './api'
import { TeacherAssignDialog } from './teacher-assign-dialog'
import { TeacherFormDialog } from './teacher-form-dialog'

type Assignment = Schemas['TeachingAssignmentDto']

function assignmentColumns(
  onUnassign: (assignment: Assignment) => void,
): Column<Assignment>[] {
  return [
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
    {
      header: <span className="sr-only">Actions</span>,
      className: 'w-14 text-right',
      cell: (a) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Stop teaching ${a.subject.name} in ${a.class.name}`}
          onClick={() => onUnassign(a)}
        >
          <UserMinus />
        </Button>
      ),
    },
  ]
}

export function TeacherDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const teacher = useTeacher(id)
  const timetable = useTeacherTimetable(id)
  const remove = useDeleteTeacher()
  const unassign = useUpdateClassSubject()
  const [assignOpen, setAssignOpen] = useState(false)
  const [unassigning, setUnassigning] = useState<Assignment | null>(null)
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
            <Button onClick={() => setAssignOpen(true)}>
              <Link2 aria-hidden /> Assign to class
            </Button>
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
            columns={assignmentColumns(setUnassigning)}
            rows={t.teaching}
            rowKey={(a) => a.classSubjectId}
            emptyTitle="Not teaching any class yet"
            emptyDescription="Use “Assign to class” above, or the Subjects tab of a class."
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

      <TeacherAssignDialog
        teacher={t}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
      <ConfirmDialog
        open={unassigning !== null}
        onOpenChange={(open) => !open && setUnassigning(null)}
        title={`Stop teaching ${unassigning?.subject.name ?? ''} in ${unassigning?.class.name ?? ''}?`}
        description="The subject stays in the class without a teacher, and its lessons stay in the timetable. Grades already given are kept."
        confirmLabel="Unassign"
        pending={unassign.isPending}
        onConfirm={() =>
          unassigning &&
          unassign.mutate(
            { id: unassigning.classSubjectId, body: { teacherId: null } },
            { onSuccess: () => setUnassigning(null) },
          )
        }
      />
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
