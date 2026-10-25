import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, type Column } from '@/components/data-table'
import { FormDialog } from '@/components/form-dialog'
import { SelectField, TextField } from '@/components/form-fields'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useSubjects } from '@/features/subjects/api'
import { useAllTeachers } from '@/features/teachers/api'
import { useClassTimetable } from '@/features/timetable/api'
import { fullName } from '@/lib/format'
import { timetableConflictOf } from '@/features/timetable/api'
import {
  useAddClassSubject,
  useRemoveClassSubject,
  useUpdateClassSubject,
  type ClassDetail,
  type ClassSubject,
} from './api'
import {
  AssignmentConflictDialog,
  type AssignmentConflictState,
} from './assignment-conflict-dialog'
import { SubjectIcon } from '@/features/subjects/subject-icon'
import { defaultMaxAbsences } from '@/features/absences/limits'

/** Subjects taught in the class, who teaches them and how many hours. */
export function ClassSubjectsTab({
  schoolClass,
  readOnly = false,
}: {
  schoolClass: ClassDetail
  /** A class of a closed year: shown as it was. */
  readOnly?: boolean
}) {
  const timetable = useClassTimetable(schoolClass.id)
  const remove = useRemoveClassSubject()
  const [editing, setEditing] = useState<ClassSubject | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [removing, setRemoving] = useState<ClassSubject | null>(null)
  const [conflict, setConflict] = useState<
    (AssignmentConflictState & { key: number }) | null
  >(null)

  // Lessons already in the timetable for each subject.
  const scheduled = new Map<string, number>()
  for (const day of timetable.data?.days ?? []) {
    for (const lesson of day.lessons) {
      scheduled.set(
        lesson.classSubjectId,
        (scheduled.get(lesson.classSubjectId) ?? 0) + 1,
      )
    }
  }

  const openForm = (assignment: ClassSubject | null) => {
    setEditing(assignment)
    setFormOpen(true)
  }

  const allColumns: Column<ClassSubject>[] = [
    {
      header: 'Subject',
      cell: (a) => (
        <div className="flex items-center gap-3">
          <SubjectIcon subject={a.subject} />
          <div className="min-w-0">
            <div className="font-medium">{a.subject.name}</div>
            {/* Narrow: the teacher and the hours under the name. */}
            <div className="text-muted-foreground text-xs whitespace-normal @xl:hidden">
              {a.teacher ? fullName(a.teacher) : 'No teacher'} ·{' '}
              {a.hoursPerWeek} h / week
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Teacher',
      className: 'hidden @xl:table-cell',
      cell: (a) =>
        a.teacher ? (
          fullName(a.teacher)
        ) : (
          <Badge variant="outline">Not assigned</Badge>
        ),
    },
    {
      header: 'Hours / week',
      cell: (a) => a.hoursPerWeek,
      className: 'hidden text-right tabular-nums @xl:table-cell',
    },
    {
      header: 'Max absences',
      className: 'hidden text-right @3xl:table-cell',
      cell: (a) =>
        a.maxAbsences === null ? (
          <span className="text-muted-foreground">No limit</span>
        ) : (
          <span className="tabular-nums">{a.maxAbsences}</span>
        ),
    },
    {
      header: 'In timetable',
      className: 'hidden text-right @2xl:table-cell',
      cell: (a) => {
        const count = scheduled.get(a.classSubjectId) ?? 0
        return (
          <Badge variant={count === a.hoursPerWeek ? 'secondary' : 'outline'}>
            {count} / {a.hoursPerWeek}
          </Badge>
        )
      },
    },
    {
      header: <span className="sr-only">Actions</span>,
      className: 'w-24 text-right',
      cell: (a) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${a.subject.name}`}
            onClick={() => openForm(a)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${a.subject.name}`}
            onClick={() => setRemoving(a)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]
  const columns = readOnly ? allColumns.slice(0, -1) : allColumns

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <p className="text-muted-foreground text-sm">
          The minimum number of grades per term is hours per week + 1. Absence
          limits are per semester and count only unexcused absences.
        </p>
        {!readOnly && (
          <Button size="sm" onClick={() => openForm(null)}>
            <Plus aria-hidden /> Add subject
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={schoolClass.subjects}
        rowKey={(a) => a.classSubjectId}
        emptyTitle="No subjects yet"
        emptyDescription="Add the subjects this class studies and who teaches them."
      />

      <ClassSubjectDialog
        schoolClass={schoolClass}
        assignment={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onConflict={(state) =>
          setConflict({ ...state, key: (conflict?.key ?? 0) + 1 })
        }
      />
      {conflict && (
        <AssignmentConflictDialog
          key={conflict.key}
          initial={conflict}
          onClose={() => setConflict(null)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.subject.name ?? ''} from class ${schoolClass.name}?`}
        description="Its lessons are removed from the timetable. Grades already given are kept."
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.classSubjectId, {
            onSuccess: () => setRemoving(null),
          })
        }
      />
    </Card>
  )
}

const schema = z.object({
  subjectId: z.string({ error: 'Pick a subject' }).min(1, 'Pick a subject'),
  teacherId: z.string().nullable(),
  hoursPerWeek: z.coerce
    .number<string>()
    .int('Whole hours only')
    .min(1, 'At least 1')
    .max(10, 'At most 10'),
  /** Empty: no limit. */
  maxAbsences: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\d+$/.test(value),
      'Whole numbers only',
    )
    .transform((value) => (value === '' ? null : Number(value)))
    .refine((value) => value === null || value <= 200, 'At most 200'),
})
type Values = z.input<typeof schema>
type Output = z.output<typeof schema>

function ClassSubjectDialog({
  schoolClass,
  assignment,
  open,
  onOpenChange,
  onConflict,
}: {
  schoolClass: ClassDetail
  assignment: ClassSubject | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConflict: (state: AssignmentConflictState) => void
}) {
  const subjects = useSubjects()
  const teachers = useAllTeachers()
  const add = useAddClassSubject()
  const update = useUpdateClassSubject({ handlesConflicts: true })
  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      subjectId: '',
      teacherId: null,
      hoursPerWeek: '1',
      maxAbsences: String(defaultMaxAbsences(1)),
    },
  })
  // The limit follows the hours (a fifth of the lessons) until it is changed
  // by hand, or if it was already set to something else.
  const followsHours = useRef(true)
  const hours = useWatch({ control: form.control, name: 'hoursPerWeek' })
  useEffect(() => {
    const value = Number(hours)
    if (!followsHours.current || !Number.isInteger(value) || value < 1) return
    form.setValue('maxAbsences', String(defaultMaxAbsences(value)))
  }, [hours, form])

  useEffect(() => {
    if (open) {
      form.reset({
        subjectId: assignment?.subject.id ?? '',
        teacherId: assignment?.teacher?.id ?? null,
        hoursPerWeek: String(assignment?.hoursPerWeek ?? 1),
        maxAbsences:
          assignment === null
            ? String(defaultMaxAbsences(1))
            : assignment.maxAbsences === null
              ? ''
              : String(assignment.maxAbsences),
      })
      followsHours.current =
        assignment === null ||
        assignment.maxAbsences === defaultMaxAbsences(assignment.hoursPerWeek)
    }
  }, [open, assignment, form])

  // A subject can be added to a class only once.
  const taken = new Set(schoolClass.subjects.map((a) => a.subject.id))
  const subjectOptions = (subjects.data ?? [])
    .filter((s) => !taken.has(s.id) || s.id === assignment?.subject.id)
    .map((s) => ({ value: s.id, label: s.name }))

  const submit = async (values: Output) => {
    if (assignment) {
      const body = {
        teacherId: values.teacherId,
        hoursPerWeek: values.hoursPerWeek,
        maxAbsences: values.maxAbsences,
      }
      try {
        await update.mutateAsync({ id: assignment.classSubjectId, body })
      } catch (error) {
        const conflict = timetableConflictOf(error)
        if (!conflict) throw error
        onConflict({
          classSubjectId: assignment.classSubjectId,
          subjectName: assignment.subject.name,
          body,
          conflict,
        })
        onOpenChange(false)
        return
      }
    } else {
      await add.mutateAsync({ classId: schoolClass.id, body: values })
    }
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={assignment ? `Edit ${assignment.subject.name}` : 'Add subject'}
      description={`Teaching assignment for class ${schoolClass.name}.`}
      form={form}
      onSubmit={submit}
      submitLabel={assignment ? 'Save changes' : 'Add subject'}
      pending={add.isPending || update.isPending}
    >
      <SelectField
        control={form.control}
        name="subjectId"
        label="Subject"
        options={subjectOptions}
        disabled={assignment !== null}
        placeholder={
          subjectOptions.length === 0 ? 'Every subject is added' : 'Select…'
        }
      />
      <SelectField
        control={form.control}
        name="teacherId"
        label="Teacher"
        noneLabel="Not assigned yet"
        options={(teachers.data?.data ?? []).map((t) => ({
          value: t.id,
          label: fullName(t),
        }))}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          control={form.control}
          name="hoursPerWeek"
          label="Hours per week"
          type="number"
          min={1}
          max={10}
          inputMode="numeric"
        />
        <TextField
          control={form.control}
          name="maxAbsences"
          label="Max absences"
          type="number"
          min={0}
          max={200}
          inputMode="numeric"
          placeholder="No limit"
          onInput={() => {
            followsHours.current = false
          }}
        />
      </div>
      <p className="text-muted-foreground -mt-2 text-sm">
        Unexcused absences allowed per semester. By default a fifth of the
        lessons ({defaultMaxAbsences(4)} for 4 hours a week); empty for no
        limit.
      </p>
    </FormDialog>
  )
}
