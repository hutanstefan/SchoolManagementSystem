import { FileSpreadsheet, History, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { PersonCell } from '@/components/person-avatar'
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
import { SubjectDot } from '@/features/subjects/subject-icon'
import { usePeriod } from '@/periods/period-context'
import { useGrades, type Grade } from './api'
import { gradeTone } from './grade-tone'
import { GradeDialog, type GradeDialogState } from './grade-dialog'
import { GradeHistoryDialog } from './grade-history-dialog'

const ALL = 'all'

/** Every grade in the school, newest first, with filters and the audit trail. */
export function GradesPage() {
  const { isArchived, year, semester } = usePeriod()
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
      className: 'hidden whitespace-nowrap @2xl:table-cell',
    },
    {
      header: 'Student',
      className: 'w-full max-w-0',
      // Narrow: the subject and the day under the name.
      cell: (g) => (
        <PersonCell
          person={g.student}
          secondary={
            <span className="@2xl:hidden">
              <span className="@xl:hidden">{g.subject.name} · </span>
              {formatDate(g.date)}
            </span>
          }
        >
          <Link
            to={`/admin/students/${g.student.id}`}
            className="hover:underline"
          >
            {fullName(g.student)}
          </Link>
        </PersonCell>
      ),
    },
    {
      header: 'Class',
      cell: (g) =>
        g.class ? <Badge variant="secondary">{g.class.name}</Badge> : '—',
      className: 'hidden @3xl:table-cell',
    },
    {
      header: 'Subject',
      className: 'hidden @xl:table-cell',
      cell: (g) => (
        <span className="flex items-center gap-2">
          <SubjectDot color={g.subject.color} />
          {g.subject.name}
        </span>
      ),
    },
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
      className: 'hidden @4xl:table-cell',
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
          {/* A closed year's grades can't change any more. */}
          {!isArchived && (
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
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Grades"
        description={
          <>
            Grades of {year ? `${year.name}, semester ${semester}` : 'the term'}
            .
            {!isArchived &&
              ' Add new grades from a class gradebook, or import them from Excel.'}
          </>
        }
        actions={
          !isArchived && (
            <Button asChild variant="outline">
              <Link to="/admin/grades/import">
                <FileSpreadsheet aria-hidden /> Import from Excel
              </Link>
            </Button>
          )
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
                  <SubjectDot color={s.color} />
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
