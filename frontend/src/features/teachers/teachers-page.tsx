import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, type Column } from '@/components/data-table'
import { PersonCell } from '@/components/person-avatar'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { SearchInput } from '@/components/search-input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDate, fullName } from '@/lib/format'
import { useDeleteTeacher, useTeachers, type Teacher } from './api'
import { TeacherFormDialog } from './teacher-form-dialog'

export function TeachersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Teacher | null>(null)

  const debouncedSearch = useDebouncedValue(search.trim())
  const teachers = useTeachers({
    page,
    pageSize: 20,
    sort: 'lastName',
    search: debouncedSearch || undefined,
  })
  const remove = useDeleteTeacher()

  const openForm = (teacher: Teacher | null) => {
    setEditing(teacher)
    setFormOpen(true)
  }

  const columns: Column<Teacher>[] = [
    {
      header: 'Name',
      // Takes the free width; long names and emails are cut with "…".
      className: 'w-full max-w-0',
      cell: (t) => <PersonCell person={t} secondary={t.email} />,
    },
    {
      header: 'Added',
      cell: (t) => formatDate(t.createdAt),
      className: 'hidden whitespace-nowrap @lg:table-cell',
    },
    {
      header: <span className="sr-only">Actions</span>,
      className: 'w-24 text-right',
      cell: (t) => (
        <div
          className="flex justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${fullName(t)}`}
            onClick={() => openForm(t)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${fullName(t)}`}
            onClick={() => setDeleting(t)}
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
        title="Teachers"
        description="Teacher accounts. Open a teacher to see what and where they teach."
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus aria-hidden /> Add teacher
          </Button>
        }
      />

      <Card className="gap-0 py-0">
        <div className="border-b p-4">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder="Search by name or email"
          />
        </div>
        <DataTable
          columns={columns}
          rows={teachers.data?.data}
          rowKey={(t) => t.id}
          isLoading={teachers.isPending}
          error={teachers.error}
          onRetry={() => void teachers.refetch()}
          emptyTitle="No teachers found"
          onRowClick={(t) => void navigate(`/admin/teachers/${t.id}`)}
        />
        <PaginationBar meta={teachers.data?.meta} onPageChange={setPage} />
      </Card>

      <TeacherFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        teacher={editing}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${fullName(deleting)}?`}
        description="Their classes lose this homeroom teacher and their subjects become unassigned. The grades they gave are kept."
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </>
  )
}
