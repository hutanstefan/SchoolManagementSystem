import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { SelectField, TextField } from '@/components/form-fields'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useAddClassSubject,
  useAllClasses,
  useClass,
  useUpdateClass,
  useUpdateClassSubject,
} from '@/features/classes/api'
import { useSubjects } from '@/features/subjects/api'
import { fullName } from '@/lib/format'
import type { TeacherDetail } from './api'

const schema = z
  .object({
    role: z.enum(['subject', 'homeroom']),
    classId: z.string().min(1, 'Pick a class'),
    subjectId: z.string(),
    hoursPerWeek: z.coerce
      .number<string>()
      .int('Whole hours only')
      .min(1, 'At least 1')
      .max(10, 'At most 10'),
  })
  .refine((v) => v.role === 'homeroom' || v.subjectId !== '', {
    path: ['subjectId'],
    message: 'Pick a subject',
  })
type Values = z.input<typeof schema>
type Output = z.output<typeof schema>

const DEFAULTS: Values = {
  role: 'subject',
  classId: '',
  subjectId: '',
  hoursPerWeek: '2',
}

/**
 * Assigns a teacher to a class from the teacher's page, either to teach a
 * subject there or as homeroom teacher. It uses the same endpoints as the
 * class page, so every rule (one teacher per subject, timetable conflicts)
 * is still checked by the API.
 */
export function TeacherAssignDialog({
  teacher,
  open,
  onOpenChange,
}: {
  teacher: TeacherDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const classes = useAllClasses('open')
  const subjects = useSubjects()
  const addSubject = useAddClassSubject()
  const updateSubject = useUpdateClassSubject()
  const updateClass = useUpdateClass()

  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  })
  useEffect(() => {
    if (open) form.reset(DEFAULTS)
  }, [open, form])

  const [role, classId, subjectId] = useWatch({
    control: form.control,
    name: ['role', 'classId', 'subjectId'],
  })
  const schoolClass = useClass(classId, { enabled: classId !== '' })
  const existing = schoolClass.data?.subjects.find(
    (s) => s.subject.id === subjectId,
  )
  const isNewSubject = role === 'subject' && subjectId !== '' && !existing

  const submit = async (values: Output) => {
    if (values.role === 'homeroom') {
      await updateClass.mutateAsync({
        id: values.classId,
        body: { homeroomTeacherId: teacher.id },
      })
    } else if (existing) {
      await updateSubject.mutateAsync({
        id: existing.classSubjectId,
        body: { teacherId: teacher.id },
      })
    } else {
      await addSubject.mutateAsync({
        classId: values.classId,
        body: {
          subjectId: values.subjectId,
          teacherId: teacher.id,
          hoursPerWeek: values.hoursPerWeek,
        },
      })
    }
    onOpenChange(false)
  }

  const c = schoolClass.data
  const hint =
    role === 'homeroom'
      ? c?.homeroomTeacher?.id === teacher.id
        ? `Already the homeroom teacher of ${c.name}.`
        : c?.homeroomTeacher
          ? `Replaces ${fullName(c.homeroomTeacher)} as homeroom teacher of ${c.name}.`
          : null
      : existing?.teacher?.id === teacher.id
        ? `Already teaches ${existing.subject.name} in ${c?.name}.`
        : existing?.teacher
          ? `Replaces ${fullName(existing.teacher)} as the ${existing.subject.name} teacher of ${c?.name}.`
          : existing
            ? `${existing.subject.name} is taught in ${c?.name} but has no teacher yet.`
            : isNewSubject && c
              ? `${c.name} doesn't study this subject yet: it is added with the hours below.`
              : null

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign to a class"
      description={`Choose what ${fullName(teacher)} does in the class.`}
      form={form}
      onSubmit={submit}
      submitLabel="Assign"
      pending={
        addSubject.isPending || updateSubject.isPending || updateClass.isPending
      }
    >
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Tabs value={field.value} onValueChange={field.onChange}>
              <TabsList className="w-full">
                <TabsTrigger value="subject">Subject teacher</TabsTrigger>
                <TabsTrigger value="homeroom">Homeroom teacher</TabsTrigger>
              </TabsList>
            </Tabs>
          </FormItem>
        )}
      />
      <SelectField
        control={form.control}
        name="classId"
        label="Class"
        options={(classes.data?.data ?? []).map((c) => ({
          value: c.id,
          label: c.name,
        }))}
      />
      {role === 'subject' && (
        <SelectField
          control={form.control}
          name="subjectId"
          label="Subject"
          options={(subjects.data ?? []).map((s) => ({
            value: s.id,
            label: s.name,
          }))}
        />
      )}
      {isNewSubject && (
        <TextField
          control={form.control}
          name="hoursPerWeek"
          label="Hours per week"
          type="number"
          min={1}
          max={10}
          inputMode="numeric"
        />
      )}
      {hint && (
        <Alert>
          <AlertDescription>{hint}</AlertDescription>
        </Alert>
      )}
    </FormDialog>
  )
}
