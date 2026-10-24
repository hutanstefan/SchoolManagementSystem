import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string | number> {
  value: T
  label: string
  disabled?: boolean
  /** Shown on hover, e.g. why an option is disabled. */
  title?: string
}

/** A small set of mutually exclusive choices, shown side by side. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'default',
}: {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  /** Accessible name of the group. */
  label: string
  className?: string
  size?: 'sm' | 'default'
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'bg-muted inline-flex items-center gap-0.5 rounded-lg p-[3px]',
        size === 'sm' ? 'h-8' : 'h-9',
        className,
      )}
    >
      {options.map((option) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'focus-visible:ring-ring/50 h-full flex-1 rounded-md px-3 font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'text-xs' : 'text-sm',
              checked
                ? 'bg-background text-foreground dark:bg-input/40 shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
