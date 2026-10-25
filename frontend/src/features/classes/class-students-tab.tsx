import { UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PersonCell } from '@/components/person-avatar'
import { DataTable, type Column } from '@/components/data-table'
import { SearchInput } from '@/components/search-input'
import { EmptyState, LoadingBlock } from '@/components/states'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useStudents, type Student } from '@/features/students/api'
import { formatDate, fullName } from '@/lib/format'
import { usePeriod } from '@/periods/period-context'
import {
  useAssignStudents,
  useClassStudents,
  useRemoveStudentFromClass,
} from './api'

export function ClassStudentsTab({
  classId,
  readOnly = false,
}: {
  classId: string
  /** A class of a closed year: its students can't change any more. */
  readOnly?: boolean
}) {
  const students = useClassStudents(classId)
  const removeStudent = useRemoveStudentFromClass()
  const [addOpen, setAddOpen] = useState(false)
  const [removing, setRemoving] = useState<Student | null>(null)

  const allColumns: Column<Student>[] = [
    {
      header: 'Reg. no.',
      cell: (s) => (
        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
          {s.registrationNumber}
        </span>
      ),
      className: 'hidden w-24 @md:table-cell',
    },
    {
      header: 'Name',
      cell: (s) => (
        <PersonCell person={s} secondary={s.email}>
          <Link to={`/admin/students/${s.id}`} className="hover:underline">
            {fullName(s)}
          </Link>
        </PersonCell>
      ),
    },
    {
      header: 'Date of birth',
      cell: (s) => formatDate(s.dateOfBirth),
      className: 'hidden whitespace-nowrap @xl:table-cell',
    },
    {
      header: <span className="sr-only">Actions</span>,
      className: 'w-14 text-right',
      cell: (s) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${fullName(s)} from the class`}
          onClick={() => setRemoving(s)}
        >
          <UserMinus />
        </Button>
      ),
    },
  ]
  const columns = readOnly ? allColumns.slice(0, -1) : allColumns

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between gap-4 border-b p-4">
        <p className="text-muted-foreground text-sm">
          {readOnly
            ? 'Students who were in this class that year.'
            : 'Students enrolled in this class.'}
        </p>
        {!readOnly && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus aria-hidden /> Add students
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={students.data}
        rowKey={(s) => s.id}
        isLoading={students.isPending}
        error={students.error}
        onRetry={() => void students.refetch()}
        emptyTitle="No students in this class"
        emptyDescription="Add students who are not in a class yet."
      />

      <AddStudentsDialog
        classId={classId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${fullName(removing)} from the class?`}
        description="The student stays in the school without a class. Their grades are kept."
        confirmLabel="Remove"
        pending={removeStudent.isPending}
        onConfirm={() =>
          removing &&
          removeStudent.mutate(
            { id: classId, studentId: removing.id },
            { onSuccess: () => setRemoving(null) },
          )
        }
      />
    </Card>
  )
}

/** Pick students who are not in any class and enrol them in this one. */
function AddStudentsDialog({
  classId,
  open,
  onOpenChange,
}: {
  classId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Only the open year's classes take students.
  const { activeYear } = usePeriod()
  const unassigned = useStudents({
    schoolYearId: activeYear?.id,
    unassigned: true,
    pageSize: 100,
    sort: 'lastName',
  })
  const assign = useAssignStudents()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')

  // Start fresh next time the dialog opens.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelected(new Set())
      setFilter('')
    }
    onOpenChange(next)
  }

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const needle = filter.trim().toLowerCase()
  const visible = (unassigned.data?.data ?? []).filter(
    (s) =>
      !needle ||
      fullName(s).toLowerCase().includes(needle) ||
      s.email.toLowerCase().includes(needle),
  )

  const submit = () =>
    assign.mutate(
      { id: classId, studentIds: [...selected] },
      { onSuccess: () => handleOpenChange(false) },
    )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add students</DialogTitle>
          <DialogDescription>
            Only students who are not in a class are listed. To move a student
            from another class, edit the student.
          </DialogDescription>
        </DialogHeader>

        {unassigned.isPending ? (
          <LoadingBlock rows={3} />
        ) : unassigned.data?.data.length === 0 ? (
          <EmptyState
            title="Every student is in a class"
            description="Create a new student from the Students page."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <SearchInput
              value={filter}
              onChange={setFilter}
              placeholder="Filter by name or email"
              className="sm:max-w-none"
            />
            <ScrollArea className="h-64 rounded-md border">
              <ul className="divide-y">
                {visible.map((s) => (
                  <li key={s.id}>
                    <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2">
                      <Checkbox
                        checked={selected.has(s.id)}
                        onCheckedChange={() => toggle(s.id)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {fullName(s)}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {s.email} · born {formatDate(s.dateOfBirth)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={assign.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <SubmitButton
            type="button"
            onClick={submit}
            pending={assign.isPending}
            disabled={selected.size === 0}
          >
            Add {selected.size > 0 ? selected.size : ''}{' '}
            {selected.size === 1 ? 'student' : 'students'}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
