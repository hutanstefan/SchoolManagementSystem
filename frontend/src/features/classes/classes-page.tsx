import { Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { DataTable, type Column } from '@/components/data-table'
import { ClassTile } from '@/components/class-tile'
import { PageHeader } from '@/components/page-header'
import { PersonCell } from '@/components/person-avatar'
import { fullName } from '@/lib/format'
import { PaginationBar } from '@/components/pagination-bar'
import { SearchInput } from '@/components/search-input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePeriod } from '@/periods/period-context'
import { useClasses, type SchoolClass } from './api'
import { describeClass } from './class-label'
import { ClassFormDialog } from './class-form-dialog'

const columns: Column<SchoolClass>[] = [
  {
    header: 'Class',
    className: 'w-full max-w-0 @md:w-auto @md:max-w-none',
    cell: (c) => (
      <div className="flex items-center gap-3">
        <ClassTile
          name={c.name}
          className="size-10 rounded-xl text-sm shadow-none"
        />
        <div className="min-w-0">
          <ClassCaption schoolClass={c} />
          {/* Narrow: the homeroom teacher's column is left out. */}
          <p className="text-muted-foreground mt-0.5 truncate text-xs @md:hidden">
            {c.homeroomTeacher
              ? `Homeroom: ${fullName(c.homeroomTeacher)}`
              : 'No homeroom teacher'}
          </p>
        </div>
      </div>
    ),
  },
  {
    header: 'Homeroom teacher',
    className: 'hidden @md:table-cell',
    cell: (c) =>
      c.homeroomTeacher ? (
        <PersonCell person={c.homeroomTeacher} />
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
  },
  {
    header: 'Students',
    cell: (c) => (
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <Users className="text-muted-foreground size-3.5" aria-hidden />
        {c.studentCount}
      </span>
    ),
    className: 'text-right',
  },
]

function ClassCaption({ schoolClass }: { schoolClass: SchoolClass }) {
  const { title, section } = describeClass(schoolClass)
  return (
    <div className="min-w-0 leading-tight">
      <p className="truncate font-medium">{title}</p>
      <p className="text-muted-foreground truncate text-xs">
        {section && `Section ${section} · `}
        {schoolClass.schoolYear.name}
      </p>
    </div>
  )
}

export function ClassesPage() {
  const { isArchived, year } = usePeriod()
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
        description={
          isArchived
            ? `The classes of ${year?.name ?? 'this year'}, as they were when the year ended.`
            : 'Open a class to manage its students, subjects, timetable and gradebook.'
        }
        actions={
          !isArchived && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus aria-hidden /> Add class
            </Button>
          )
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
