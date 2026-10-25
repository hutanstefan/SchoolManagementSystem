import {
  BookOpenText,
  Download,
  Eye,
  FileText,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserX,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '@/auth/auth-context'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { SearchInput } from '@/components/search-input'
import { EmptyState, ErrorState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useSubjects } from '@/features/subjects/api'
import { SUBJECT_COLORS } from '@/features/subjects/subject-colors'
import { SubjectIcon } from '@/features/subjects/subject-icon'
import { useMyTeacherProfile } from '@/features/teachers/api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatBytes, formatTimeAgo, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Schemas } from '@/api/client'
import { useDeleteLecture, useLectures, type Lecture } from './api'
import {
  EditLectureDialog,
  LectureAccessDialog,
  LectureHistoryDialog,
  ShareLectureDialog,
} from './lecture-dialogs'
import { LecturePreview } from './lecture-preview'
import {
  canPreviewInline,
  downloadLecture,
  openLectureInNewTab,
} from './open-lecture'

type Subject = Schemas['SubjectSummaryDto']

/** Cards per page: four rows of three on a wide screen. */
const PAGE_SIZE = 12

/** Shared in the last three days: worth a "New" badge for students. */
const isNew = (lecture: Lecture) =>
  Date.now() - new Date(lecture.createdAt).getTime() < 3 * 24 * 3600 * 1000

const students = (count: number) =>
  `${count} ${count === 1 ? 'student' : 'students'}`

function LectureCard({
  lecture,
  showTeacher,
  onPreview,
  onEdit,
  onAccess,
  onHistory,
  onDelete,
}: {
  lecture: Lecture
  showTeacher: boolean
  onPreview: () => void
  onEdit: () => void
  onAccess: () => void
  onHistory: () => void
  onDelete: () => void
}) {
  const manage = lecture.canManage
  const unshared = manage && lecture.studentCount === 0
  return (
    <Card className="hover:shadow-lifted group relative gap-0 overflow-hidden py-0 transition-shadow">
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 h-1',
          SUBJECT_COLORS[lecture.subject.color].solid,
        )}
      />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <SubjectIcon subject={lecture.subject} className="size-10" />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <span className="truncate">{lecture.subject.name}</span>
              <span aria-hidden>·</span>
              <span className="whitespace-nowrap">
                {formatTimeAgo(lecture.createdAt)}
              </span>
            </p>
            <h3 className="mt-0.5 line-clamp-2 leading-snug font-semibold">
              <button
                type="button"
                onClick={onPreview}
                className="text-left hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {lecture.title}
              </button>
            </h3>
          </div>
          {!lecture.canManage && isNew(lecture) && (
            <Badge variant="primary-soft">New</Badge>
          )}
          {manage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mt-1 -mr-2 size-8"
                  aria-label={`More for ${lecture.title}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil aria-hidden /> Edit details
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onAccess}>
                  <Send aria-hidden /> Share with students
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onHistory}>
                  <History aria-hidden /> Access history
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2 aria-hidden /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {lecture.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {lecture.description}
          </p>
        )}

        <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5" aria-hidden />
            PDF · {formatBytes(lecture.fileSize)}
          </span>
          {showTeacher && (
            <span className="truncate">
              {lecture.teacher
                ? `by ${fullName(lecture.teacher)}`
                : 'Teacher deleted'}
            </span>
          )}
          {manage && !unshared && (
            <button
              type="button"
              onClick={onAccess}
              className="hover:text-foreground inline-flex items-center gap-1.5 hover:underline"
              title="Who can read it"
            >
              <Users className="size-3.5" aria-hidden />
              {students(lecture.studentCount)}
            </button>
          )}
        </div>

        {unshared && (
          <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 px-3 py-2">
            <UserX
              className="size-4 shrink-0 text-amber-700 dark:text-amber-300"
              aria-hidden
            />
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Not shared with anyone
              </p>
              <p className="text-muted-foreground truncate">
                Only you can open it
              </p>
            </div>
            <Button size="sm" className="h-7 px-2.5" onClick={onAccess}>
              <Send aria-hidden /> Share
            </Button>
          </div>
        )}
      </div>
      <div className="bg-muted/30 flex gap-2 border-t px-5 py-3">
        <Button size="sm" variant="outline" onClick={onPreview}>
          <Eye aria-hidden /> Preview
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void downloadLecture(lecture.id)}
        >
          <Download aria-hidden /> Download
        </Button>
        {manage && (
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive ml-auto size-8"
            aria-label={`Delete ${lecture.title}`}
            title="Delete"
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </Card>
  )
}

/** The subjects a teacher can share lectures in: the ones they teach this year. */
function useShareSubjects(enabled: boolean): Subject[] {
  const profile = useMyTeacherProfile({ enabled, year: 'open' })
  return useMemo(() => {
    const bySubject = new Map<string, Subject>()
    for (const assignment of profile.data?.teaching ?? []) {
      bySubject.set(assignment.subject.id, assignment.subject)
    }
    return [...bySubject.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [profile.data])
}

/**
 * Lectures (PDFs). Each teacher has a library of them and shares them with
 * any students, until they remove them; students read the ones shared with
 * them; admins see every library. Not tied to the school year picked in the
 * sidebar.
 */
export function LecturesPage() {
  const { user } = useAuth()
  const role = user?.role
  const isTeacher = role === 'TEACHER'
  const isStudent = role === 'STUDENT'
  const [search, setSearch] = useState('')
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search.trim())
  const lectures = useLectures({
    page,
    pageSize: PAGE_SIZE,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(subjectId && { subjectId }),
  })
  const teacherSubjects = useShareSubjects(isTeacher)
  const allSubjects = useSubjects()
  const remove = useDeleteLecture()

  const [shareOpen, setShareOpen] = useState(false)
  const [previewing, setPreviewing] = useState<Lecture | null>(null)
  const [editing, setEditing] = useState<Lecture | null>(null)
  const [access, setAccess] = useState<Lecture | null>(null)
  const [history, setHistory] = useState<Lecture | null>(null)
  const [deleting, setDeleting] = useState<Lecture | null>(null)

  const shown = lectures.data?.data ?? []
  const subjects = lectures.data?.subjects ?? []
  const filtered = debouncedSearch !== '' || subjectId !== null
  // Nothing at all, not just nothing matching the filters.
  const empty = !filtered && lectures.data?.meta.total === 0
  const canShare = isTeacher
  // Past the last page (its last lecture was just deleted): go back.
  const lastPage = Math.max(1, lectures.data?.meta.totalPages ?? 1)
  if (lectures.data && !lectures.isPlaceholderData && page > lastPage) {
    setPage(lastPage)
  }
  const pickSubject = (id: string | null) => {
    setSubjectId(id)
    setPage(1)
  }

  const preview = (lecture: Lecture) => {
    if (canPreviewInline()) setPreviewing(lecture)
    else void openLectureInNewTab(lecture.id)
  }

  return (
    <>
      <PageHeader
        title="Lectures"
        description={
          isStudent
            ? 'Reading material your teachers shared with you.'
            : isTeacher
              ? 'Your library of PDFs. Share them with any students: they keep access until you remove it, and every change is kept in the access history.'
              : "Every lecture in the teachers' libraries, and who can read it."
        }
        actions={
          canShare && (
            <Button
              onClick={() => setShareOpen(true)}
              disabled={teacherSubjects.length === 0}
              title={
                teacherSubjects.length === 0
                  ? 'You need to teach a subject this year to share lectures'
                  : undefined
              }
            >
              <Plus aria-hidden /> Add a lecture
            </Button>
          )
        }
      />

      {(subjects.length > 0 || filtered) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder="Search lectures"
          />
          {subjects.length > 1 && (
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Filter by subject"
            >
              <Button
                size="sm"
                variant={subjectId === null ? 'default' : 'outline'}
                className="h-8 rounded-full"
                aria-pressed={subjectId === null}
                onClick={() => pickSubject(null)}
              >
                All
              </Button>
              {subjects.map((subject) => (
                <Button
                  key={subject.id}
                  size="sm"
                  variant={subjectId === subject.id ? 'default' : 'outline'}
                  className="h-8 rounded-full"
                  aria-pressed={subjectId === subject.id}
                  onClick={() =>
                    pickSubject(subjectId === subject.id ? null : subject.id)
                  }
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-2 rounded-full',
                      SUBJECT_COLORS[subject.color].solid,
                    )}
                  />
                  {subject.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {lectures.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : lectures.error ? (
        <Card>
          <ErrorState
            error={lectures.error}
            onRetry={() => void lectures.refetch()}
          />
        </Card>
      ) : empty ? (
        <Card>
          <EmptyState
            icon={BookOpenText}
            title="No lectures yet"
            description={
              isStudent
                ? 'When a teacher shares a lecture with you, it shows up here (you also get a notification).'
                : isTeacher
                  ? 'Add PDFs to your library and share them with whole classes, or with any students you choose.'
                  : 'Teachers share lectures from their own Lectures page.'
            }
            action={
              canShare &&
              teacherSubjects.length > 0 && (
                <Button onClick={() => setShareOpen(true)}>
                  <Plus aria-hidden /> Add a lecture
                </Button>
              )
            }
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            title="No lecture matches"
            description="Try another search or subject."
          />
        </Card>
      ) : (
        <>
          <ul
            className={cn(
              'grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3',
              lectures.isPlaceholderData && 'opacity-60',
            )}
          >
            {shown.map((lecture) => (
              <li key={lecture.id} className="flex">
                <LectureCard
                  lecture={lecture}
                  showTeacher={!isTeacher}
                  onPreview={() => preview(lecture)}
                  onEdit={() => setEditing(lecture)}
                  onAccess={() => setAccess(lecture)}
                  onHistory={() => setHistory(lecture)}
                  onDelete={() => setDeleting(lecture)}
                />
              </li>
            ))}
          </ul>
          {lectures.data && lectures.data.meta.totalPages > 1 && (
            <Card className="mt-4 gap-0 py-0 [&>div]:border-t-0">
              <PaginationBar
                meta={lectures.data.meta}
                onPageChange={(next) => {
                  setPage(next)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            </Card>
          )}
        </>
      )}

      {isTeacher && (
        <ShareLectureDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          subjects={teacherSubjects}
        />
      )}
      <LecturePreview
        lecture={previewing}
        onClose={() => setPreviewing(null)}
      />
      <EditLectureDialog
        lecture={editing}
        onClose={() => setEditing(null)}
        subjects={isTeacher ? teacherSubjects : (allSubjects.data ?? [])}
      />
      <LectureAccessDialog lecture={access} onClose={() => setAccess(null)} />
      <LectureHistoryDialog
        lecture={history}
        onClose={() => setHistory(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.title ?? ''}?`}
        description="The PDF is deleted with its history, and nobody can read it any more. This can't be undone."
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </>
  )
}
