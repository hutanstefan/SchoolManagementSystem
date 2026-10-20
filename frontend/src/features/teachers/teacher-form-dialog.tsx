import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { TextField } from '@/components/form-fields'
import {
  emailField,
  nameField,
  optionalPasswordField,
  passwordField,
} from '@/lib/validation'
import { useCreateTeacher, useUpdateTeacher, type Teacher } from './api'

const baseSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  email: emailField,
})
const createSchema = baseSchema.extend({ password: passwordField })
const editSchema = baseSchema.extend({ password: optionalPasswordField })

type Values = z.infer<typeof editSchema>

type TeacherFields = Pick<Teacher, 'id' | 'firstName' | 'lastName' | 'email'>

function toValues(teacher: TeacherFields | null): Values {
  return {
    firstName: teacher?.firstName ?? '',
    lastName: teacher?.lastName ?? '',
    email: teacher?.email ?? '',
    password: '',
  }
}

/** Create a teacher (teacher = null) or edit an existing one. */
export function TeacherFormDialog({
  open,
  onOpenChange,
  teacher,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teacher: TeacherFields | null
}) {
  const isEdit = teacher !== null
  const create = useCreateTeacher()
  const update = useUpdateTeacher()

  const form = useForm<Values>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: toValues(teacher),
  })

  useEffect(() => {
    if (open) form.reset(toValues(teacher))
  }, [open, teacher, form])

  const submit = async ({ password, ...rest }: Values) => {
    if (isEdit) {
      await update.mutateAsync({
        id: teacher.id,
        body: password ? { ...rest, password } : rest,
      })
    } else {
      await create.mutateAsync({ ...rest, password })
    }
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit teacher' : 'Add teacher'}
      description={
        isEdit
          ? 'Change the teacher’s details or reset their password.'
          : 'Creates the teacher account they will log in with.'
      }
      form={form}
      onSubmit={submit}
      submitLabel={isEdit ? 'Save changes' : 'Add teacher'}
      pending={create.isPending || update.isPending}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="firstName" label="First name" />
        <TextField control={form.control} name="lastName" label="Last name" />
      </div>
      <TextField
        control={form.control}
        name="email"
        label="Email"
        type="email"
        autoComplete="off"
      />
      <TextField
        control={form.control}
        name="password"
        label={isEdit ? 'New password' : 'Password'}
        type="password"
        autoComplete="new-password"
        description={
          isEdit
            ? 'Leave empty to keep the current password. Changing it logs the teacher out.'
            : 'At least 8 characters, with a letter and a digit.'
        }
      />
    </FormDialog>
  )
}
