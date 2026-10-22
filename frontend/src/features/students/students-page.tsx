import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, type Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { SearchInput } from '@/components/search-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAllClasses } from '@/features/classes/api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDate, fullName } from '@/lib/format'
import {
  useDeleteStudent,
  useStudents,
  type Student,
  type StudentQuery,
} from './api'
import { StudentFormDialog } from './student-form-dialog'

const ALL = 'all'
const UNASSIGNED = 'unassigned'

export function StudentsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  // ?class=unassigned (or a class id) pre-selects the filter, e.g. from the dashboard.
  const [classFilter, setClassFilter] = useState(
    searchParams.get('class') ?? ALL,
  )
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Student | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Student | null>(null)

  const debouncedSearch = useDebouncedValue(search.trim())
  const query: StudentQuery = {
    page,
    pageSize: 20,
    sort: 'lastName',
    search: debouncedSearch || undefined,
    ...(classFilter === UNASSIGNED
      ? { unassigned: true }
      : classFilter !== ALL
        ? { classId: classFilter }
        : {}),
  }
  const students = useStudents(query)
  const classes = useAllClasses()
  const remove = useDeleteStudent()

  const openForm = (student: Student | null) => {
    setEditing(student)
    setFormOpen(true)
  }

  const columns: Column<Student>[] = [
    {
      header: 'Reg. no.',
      cell: (s) => (
        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
          {s.registrationNumber}
        </span>
      ),
      className: 'w-24',
    },
    {
      header: 'Name',
      cell: (s) => <span className="font-medium">{fullName(s)}</span>,
    },
    {
      header: 'Email',
      cell: (s) => s.email,
      className: 'hidden md:table-cell',
    },
    {
      header: 'Class',
      cell: (s) =>
        s.class ? (
          <Badge variant="secondary">{s.class.name}</Badge>
        ) : (
          <span className="text-muted-foreground">Not assigned</span>
        ),
    },
    {
      header: 'Date of birth',
      cell: (s) => formatDate(s.dateOfBirth),
      className: 'hidden lg:table-cell',
    },
    {
      header: <span className="sr-only">Actions</span>,
      className: 'w-24 text-right',
      cell: (s) => (
        <div
          className="flex justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${fullName(s)}`}
            onClick={() => openForm(s)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${fullName(s)}`}
            onClick={() => setDeleting(s)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Students"
        description="Every student account, with the class they belong to."
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus aria-hidden /> Add student
          </Button>
        }
      />

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder="Search by name, email or reg. no."
          />
          <Select
            value={classFilter}
            onValueChange={(value) => {
              setClassFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="sm:w-48" aria-label="Filter by class">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All classes</SelectItem>
              <SelectItem value={UNASSIGNED}>Not assigned</SelectItem>
              {classes.data?.data.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          rows={students.data?.data}
          rowKey={(s) => s.id}
          isLoading={students.isPending}
          error={students.error}
          onRetry={() => void students.refetch()}
          emptyTitle="No students found"
          emptyDescription="Try another search or class filter."
          onRowClick={(s) => void navigate(`/admin/students/${s.id}`)}
        />
        <PaginationBar meta={students.data?.meta} onPageChange={setPage} />
      </Card>

      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        student={editing}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${fullName(deleting)}?`}
        description="The account and all of the student's grades are deleted. This cannot be undone."
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </>
  )
}
