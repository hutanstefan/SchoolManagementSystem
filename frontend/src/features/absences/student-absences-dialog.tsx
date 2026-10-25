import { CalendarRange, Check, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState, LoadingBlock } from '@/components/states'
import { SubmitButton } from '@/components/submit-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Semester } from '@/features/school-years/api'
import { SubjectDot } from '@/features/subjects/subject-icon'
import { formatDate, fullName, todayIso } from '@/lib/format'
import {
  useAbsences,
  useDeleteAbsence,
  useExcuseAbsences,
  useUpdateAbsence,
  type Absence,
} from './api'

const PAGE_SIZE = 10

export interface StudentAbsencesTarget {
  student: { id: string; name: string }
  /** One subject; every subject when omitted. */
  subject?: { id: string; name: string }
  schoolYearId?: string
  semester?: Semester
  /** Homeroom teacher or admin, open year: may excuse several days at once. */
  canExcusePeriod?: boolean
}

/**
 * A student's absences, newest first. Who may change them (the teacher who
 * recorded one, the homeroom teacher, admins) can excuse or delete them here.
 */
export function StudentAbsencesDialog({
  target,
  onClose,
}: {
  target: StudentAbsencesTarget | null
  onClose: () => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {target && (
          <AbsenceList
            key={`${target.student.id}-${target.subject?.id ?? 'all'}-${target.semester ?? ''}`}
            target={target}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AbsenceList({ target }: { target: StudentAbsencesTarget }) {
  const [page, setPage] = useState(1)
  const [excusing, setExcusing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Absence | null>(null)
  const [periodOpen, setPeriodOpen] = useState(false)
  const absences = useAbsences({
    studentId: target.student.id,
    subjectId: target.subject?.id,
    schoolYearId: target.schoolYearId,
    semester: target.semester,
    page,
    pageSize: PAGE_SIZE,
  })
  const update = useUpdateAbsence()
  const remove = useDeleteAbsence()
  const meta = absences.data?.meta

  const unexcuse = (absence: Absence) =>
    update.mutate(
      { id: absence.id, body: { excused: false } },
      { onSuccess: () => toast.success('The absence counts again') },
    )

  return (
    <>
      <DialogHeader>
        <DialogTitle>Absences of {target.student.name}</DialogTitle>
        <DialogDescription>
          {[
            target.subject?.name ?? 'Every subject',
            target.semester && `semester ${target.semester}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          . Only unexcused absences count against the limit.
        </DialogDescription>
      </DialogHeader>

      {periodOpen && (
        <ExcusePeriodForm
          studentId={target.student.id}
          onDone={() => setPeriodOpen(false)}
        />
      )}

      <div className="-mx-2 max-h-[420px] min-h-24 overflow-y-auto">
        {absences.isPending ? (
          <LoadingBlock rows={4} />
        ) : absences.error ? (
          <ErrorState
            error={absences.error}
            onRetry={() => void absences.refetch()}
          />
        ) : absences.data.data.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            No absences.
          </p>
        ) : (
          <ul className="divide-y">
            {absences.data.data.map((absence) => (
              <li key={absence.id} className="px-2 py-2.5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                      <span className="font-medium tabular-nums">
                        {formatDate(absence.date)}
                      </span>
                      {!target.subject && (
                        <span className="flex items-center gap-1.5">
                          <SubjectDot color={absence.subject.color} />
                          {absence.subject.name}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      Recorded by{' '}
                      {absence.recordedBy
                        ? fullName(absence.recordedBy)
                        : 'a deleted user'}
                      {absence.excused && absence.excusedBy && (
                        <>
                          {' '}
                          · excused by {fullName(absence.excusedBy)}
                          {absence.excuseNote && `: “${absence.excuseNote}”`}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {absence.excused ? (
                      <Badge variant="success-soft">Excused</Badge>
                    ) : (
                      <Badge variant="destructive-soft">Unexcused</Badge>
                    )}
                    {absence.canChange &&
                      (absence.excused ? (
                        <IconAction
                          label="Take the excuse back"
                          onClick={() => unexcuse(absence)}
                          disabled={update.isPending}
                        >
                          <Undo2 />
                        </IconAction>
                      ) : (
                        <IconAction
                          label="Excuse"
                          onClick={() =>
                            setExcusing(
                              excusing === absence.id ? null : absence.id,
                            )
                          }
                        >
                          <Check />
                        </IconAction>
                      ))}
                    {absence.canChange && (
                      <IconAction
                        label="Delete"
                        onClick={() => setDeleting(absence)}
                      >
                        <Trash2 />
                      </IconAction>
                    )}
                  </div>
                </div>
                {excusing === absence.id && (
                  <ExcuseOneForm
                    absence={absence}
                    onDone={() => setExcusing(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <DialogFooter className="items-center gap-2 sm:justify-between">
        {meta && meta.totalPages > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Newer
            </Button>
            <span className="text-muted-foreground tabular-nums">
              {page} / {meta.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Older
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">
            {meta ? `${meta.total} in total` : ''}
          </span>
        )}
        {target.canExcusePeriod && !periodOpen && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setPeriodOpen(true)}
          >
            <CalendarRange aria-hidden /> Excuse a period
          </Button>
        )}
      </DialogFooter>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this absence?"
        description={
          deleting &&
          `${deleting.subject.name}, ${formatDate(deleting.date)}. Only for an absence recorded by mistake; to forgive it, excuse it instead.`
        }
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </>
  )
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ExcuseOneForm({
  absence,
  onDone,
}: {
  absence: Absence
  onDone: () => void
}) {
  const update = useUpdateAbsence()
  const [note, setNote] = useState('')
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    update.mutate(
      { id: absence.id, body: { excused: true, note: note.trim() || null } },
      {
        onSuccess: () => {
          toast.success('Absence excused')
          onDone()
        },
      },
    )
  }
  return (
    <form
      onSubmit={submit}
      className="bg-muted/50 mt-2 flex items-center gap-2 rounded-md p-2"
    >
      <Input
        autoFocus
        value={note}
        maxLength={200}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Reason (optional), e.g. Medical note"
        aria-label="Reason"
        className="bg-background h-8"
      />
      <Button type="button" variant="ghost" size="sm" onClick={onDone}>
        Cancel
      </Button>
      <SubmitButton size="sm" pending={update.isPending}>
        Excuse
      </SubmitButton>
    </form>
  )
}

/** Every unexcused absence between two days, in every subject. */
function ExcusePeriodForm({
  studentId,
  onDone,
}: {
  studentId: string
  onDone: () => void
}) {
  const excuse = useExcuseAbsences()
  const today = todayIso()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [note, setNote] = useState('')
  const invalid = from === '' || to === '' || from > to
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (invalid) return
    excuse.mutate(
      { studentId, from, to, note: note.trim() || undefined },
      {
        onSuccess: ({ excused }) => {
          toast.success(
            excused === 0
              ? 'No unexcused absences in that period'
              : `${excused} ${excused === 1 ? 'absence' : 'absences'} excused`,
          )
          onDone()
        },
      },
    )
  }
  return (
    <form
      onSubmit={submit}
      className="bg-muted/50 grid gap-3 rounded-lg border p-3"
    >
      <p className="text-sm font-medium">
        Excuse every absence between two days, in every subject
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="excuse-from">From</Label>
          <Input
            id="excuse-from"
            type="date"
            value={from}
            max={today}
            onChange={(event) => setFrom(event.target.value)}
            className="bg-background"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="excuse-to">To</Label>
          <Input
            id="excuse-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-invalid={from > to}
            className="bg-background"
          />
        </div>
      </div>
      {from > to && (
        <p className="text-destructive -mt-1 text-sm">
          The first day comes after the last one
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="excuse-note">Reason</Label>
        <Input
          id="excuse-note"
          value={note}
          maxLength={200}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. Medical note"
          className="bg-background"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton size="sm" pending={excuse.isPending} disabled={invalid}>
          Excuse absences
        </SubmitButton>
      </div>
    </form>
  )
}
