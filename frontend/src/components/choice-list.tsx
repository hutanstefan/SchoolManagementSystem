import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface Choice<T extends string> {
  value: T
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

/** Radio options shown as cards: pick one way to resolve something. */
export function ChoiceList<T extends string>({
  name,
  legend,
  value,
  onChange,
  choices,
}: {
  name: string
  legend: string
  value: T | null
  onChange: (value: T) => void
  choices: Choice<T>[]
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{legend}</legend>
      {choices.map((choice) => (
        <label
          key={choice.value}
          className={cn(
            'hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition',
            value === choice.value && 'border-primary bg-primary/5',
            choice.disabled && 'pointer-events-none opacity-50',
          )}
        >
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={value === choice.value}
            disabled={choice.disabled}
            onChange={() => onChange(choice.value)}
            className="accent-primary mt-0.5 size-4 shrink-0"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{choice.label}</span>
            {choice.description && (
              <span className="text-muted-foreground">
                {choice.description}
              </span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
