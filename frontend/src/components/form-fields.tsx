import type { ComponentProps, ReactNode } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Radix Select can't use "" as a value, so "nothing selected" gets its own. */
export const NONE = '__none__'

interface BaseFieldProps<T extends FieldValues, TOut> {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
  description?: ReactNode
}

export function TextField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  description,
  ...inputProps
}: BaseFieldProps<T, TOut> &
  Omit<ComponentProps<typeof Input>, 'name' | 'value' | 'onChange'>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...inputProps} {...field} value={field.value ?? ''} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export interface Option {
  value: string
  label: string
}

/**
 * Select bound to a string field. With `noneLabel`, an extra first option maps
 * to null, for optional relations like "no class" or "no homeroom teacher".
 */
export function SelectField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  description,
  options,
  placeholder = 'Select…',
  noneLabel,
  disabled,
}: BaseFieldProps<T, TOut> & {
  options: Option[]
  placeholder?: string
  noneLabel?: string
  disabled?: boolean
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={(field.value as string | null) ?? (noneLabel ? NONE : '')}
            onValueChange={(value) =>
              field.onChange(value === NONE ? null : value)
            }
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
