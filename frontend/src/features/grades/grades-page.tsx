import { History, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
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
import { useSubjects } from '@/features/subjects/api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDate, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useGrades, type Grade } from './api'
import { gradeTone } from './grade-tone'
import { GradeDialog, type GradeDialogState } from './grade-dialog'
import { GradeHistoryDialog } from './grade-history-dialog'

const ALL = 'all'

/** Every grade in the school, newest first, with filters and the audit trail. */
export function GradesPage() {
  const [search, setSearch] = useState('')
  const [classId, setClassId] = useState(ALL)
  const [subjectId, setSubjectId] = useState(ALL)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<GradeDialogState | null>(null)
  const [historyOf, setHistoryOf] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search.trim())
  const grades = useGrades({
    page,
    pageSize: 20,
    sort: 'date',
    order: 'desc',
    search: debouncedSearch || undefined,
    classId: classId === ALL ? undefined : classId,
    subjectId: subjectId === ALL ? undefined : subjectId,
  })
  const classes = useAllClasses()
  const subjects = useSubjects()

  const columns: Column<Grade>[] = [
    {
      header: 'Date',
      cell: (g) => formatDate(g.date),
      className: 'whitespace-nowrap',
    },
    {
      header: 'Student',
      cell: (g) => (
        <Link
          to={`/admin/students/${g.student.id}`}
          className="font-medium hover:underline"
        >
          {fullName(g.student)}
        </Link>
      ),
    },
    {
      header: 'Class',
      cell: (g) =>
        g.class ? <Badge variant="secondary">{g.class.name}</Badge> : '—',
      className: 'hidden sm:table-cell',
    },
    { header: 'Subject', cell: (g) => g.subject.name },
    {
      header: 'Grade',
      cell: (g) => (
        <span
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-md border text-sm font-semibold',
            gradeTone(g.value),
          )}
        >
          {g.value}
        </span>
      ),
    },
    {
      header: 'Teacher',
      cell: (g) => (g.teacher ? fullName(g.teacher) : '—'),
      className: 'hidden lg:table-cell',
    },
    {
      header: <span className="sr-only">Actions</span>,
      className: 'w-24 text-right',
      cell: (g) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Show history"
            onClick={() => setHistoryOf(g.id)}
          >
            <History />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit grade"
            onClick={() =>
              setEditing({
                mode: 'edit',
                grade: g,
                student: { id: g.student.id, name: fullName(g.student) },
                subject: g.subject,
              })
            }
          >
            <Pencil />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Grades"
        description="All grades in the school. Add new grades from a class gradebook."
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder="Search by student name"
          />
          <Select
            value={classId}
            onValueChange={(value) => {
              setClassId(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="sm:w-40" aria-label="Filter by class">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All classes</SelectItem>
              {classes.data?.data.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={subjectId}
            onValueChange={(value) => {
              setSubjectId(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="sm:w-48" aria-label="Filter by subject">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All subjects</SelectItem>
              {subjects.data?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DataTable
          columns={columns}
          rows={grades.data?.data}
          rowKey={(g) => g.id}
          isLoading={grades.isPending}
          error={grades.error}
          onRetry={() => void grades.refetch()}
          emptyTitle="No grades found"
          emptyDescription="Try other filters."
        />
        <PaginationBar meta={grades.data?.meta} onPageChange={setPage} />
      </Card>

      <GradeDialog state={editing} onClose={() => setEditing(null)} />
      <GradeHistoryDialog
        gradeId={historyOf}
        onClose={() => setHistoryOf(null)}
      />
    </>
  )
}
