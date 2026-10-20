import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { DataTable, type Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { SearchInput } from '@/components/search-input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { fullName } from '@/lib/format'
import { useClasses, type SchoolClass } from './api'
import { ClassFormDialog } from './class-form-dialog'

const columns: Column<SchoolClass>[] = [
  {
    header: 'Class',
    cell: (c) => <span className="font-medium">{c.name}</span>,
  },
  {
    header: 'Homeroom teacher',
    cell: (c) =>
      c.homeroomTeacher ? (
        fullName(c.homeroomTeacher)
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
  },
  {
    header: 'Students',
    cell: (c) => c.studentCount,
    className: 'text-right tabular-nums',
  },
]

export function ClassesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)

  const debouncedSearch = useDebouncedValue(search.trim())
  const classes = useClasses({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
  })

  return (
    <>
      <PageHeader
        title="Classes"
        description="Open a class to manage its students, subjects, timetable and gradebook."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus aria-hidden /> Add class
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
            placeholder="Search classes"
          />
        </div>
        <DataTable
          columns={columns}
          rows={classes.data?.data}
          rowKey={(c) => c.id}
          isLoading={classes.isPending}
          error={classes.error}
          onRetry={() => void classes.refetch()}
          emptyTitle="No classes found"
          onRowClick={(c) => void navigate(`/admin/classes/${c.id}`)}
        />
        <PaginationBar meta={classes.data?.meta} onPageChange={setPage} />
      </Card>

      <ClassFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        schoolClass={null}
        onCreated={(created) => void navigate(`/admin/classes/${created.id}`)}
      />
    </>
  )
}
