import { useState } from 'react'
import { toast } from 'sonner'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Semester } from '@/features/school-years/api'
import { todayIso } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useTakeAttendance } from './api'

export interface AttendanceStudent {
  id: string
  name: string
  registrationNumber: string
}

export interface AttendanceTarget {
  classId: string
  className?: string
  subject: { id: string; name: string }
  students: AttendanceStudent[]
  /** Admins only: the semester the absences count for. */
  semester?: Semester
}

/** Take attendance for a lesson: tick the students who were absent. */
export function AttendanceDialog({
  target,
  onClose,
}: {
  target: AttendanceTarget | null
  onClose: () => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed by subject so every opening starts with a clean sheet. */}
        {target && (
          <AttendanceForm
            key={`${target.classId}-${target.subject.id}`}
            target={target}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AttendanceForm({
  target,
  onDone,
}: {
  target: AttendanceTarget
  onDone: () => void
}) {
  const take = useTakeAttendance()
  const [date, setDate] = useState(todayIso())
  const [absent, setAbsent] = useState<Set<string>>(new Set())
  const today = todayIso()
  const validDate = date !== '' && date <= today

  const toggle = (id: string) =>
    setAbsent((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validDate || absent.size === 0) return
    try {
      const result = await take.mutateAsync({
        classId: target.classId,
        subjectId: target.subject.id,
        date,
        semester: target.semester,
        studentIds: [...absent],
      })
      const recorded = `${result.recorded} ${result.recorded === 1 ? 'absence' : 'absences'} recorded`
      toast.success(
        result.alreadyAbsent > 0
          ? `${recorded}; ${result.alreadyAbsent} already marked absent that day`
          : recorded,
      )
      onDone()
    } catch {
      // The error toast comes from the MutationCache; keep the dialog open.
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="contents">
      <DialogHeader>
        <DialogTitle>Take attendance</DialogTitle>
        <DialogDescription>
          {[
            target.subject.name,
            target.className && `class ${target.className}`,
            target.semester && `semester ${target.semester}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          . Tick the students who are absent.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="attendance-date">Date of the lesson</Label>
        <Input
          id="attendance-date"
          type="date"
          value={date}
          max={today}
          onChange={(event) => setDate(event.target.value)}
          aria-invalid={!validDate}
        />
        {!validDate && (
          <p className="text-destructive text-sm">
            {date === '' ? 'Pick a date' : 'Cannot be in the future'}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {absent.size === 0
            ? 'Everyone is present'
            : `${absent.size} absent of ${target.students.length}`}
        </span>
        {absent.size > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAbsent(new Set())}
          >
            Clear
          </Button>
        )}
      </div>
      <ul className="-mx-2 max-h-80 overflow-y-auto">
        {target.students.map((student) => {
          const checked = absent.has(student.id)
          const id = `absent-${student.id}`
          return (
            <li key={student.id}>
              <label
                htmlFor={id}
                className={cn(
                  'hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm',
                  checked && 'bg-destructive/5',
                )}
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={() => toggle(student.id)}
                />
                <span className="flex-1 font-medium">{student.name}</span>
                {checked ? (
                  <span className="text-destructive text-xs font-medium">
                    Absent
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {student.registrationNumber}
                  </span>
                )}
              </label>
            </li>
          )
        })}
      </ul>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <SubmitButton
          pending={take.isPending}
          disabled={absent.size === 0 || !validDate}
        >
          {absent.size === 0 ? 'Mark absent' : `Mark ${absent.size} absent`}
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}
