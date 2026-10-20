import type { ComponentProps } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatAverage, formatDate, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GradeEntry } from './api'
import { gradeTone } from './grade-tone'

/**
 * One grade as a small square, with date and teacher in a tooltip. Becomes a
 * button when `onClick` is given (e.g. to edit the grade).
 */
export function GradeChip({
  grade,
  onClick,
  className,
}: {
  grade: GradeEntry
  onClick?: () => void
  className?: string
}) {
  const label = `${grade.value} on ${formatDate(grade.date)}${
    grade.teacher ? ` by ${fullName(grade.teacher)}` : ''
  }`
  const props: ComponentProps<'span'> = {
    className: cn(
      'inline-flex size-8 items-center justify-center rounded-md border text-sm font-semibold tabular-nums',
      gradeTone(grade.value),
      onClick && 'hover:ring-ring/50 cursor-pointer hover:ring-2',
      className,
    ),
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {onClick ? (
          <button
            type="button"
            {...(props as ComponentProps<'button'>)}
            onClick={onClick}
            aria-label={`Edit grade ${label}`}
          >
            {grade.value}
          </button>
        ) : (
          <span {...props} tabIndex={0} aria-label={`Grade ${label}`}>
            {grade.value}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The average as on a Romanian report card: exact value (2 decimals) and the
 * rounded grade that counts, e.g. "8.50 → 9".
 */
export function AverageCell({
  average,
  roundedAverage,
}: {
  average: number | null
  roundedAverage: number | null
}) {
  if (average === null || roundedAverage === null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className="text-muted-foreground text-sm">
        {formatAverage(average)}
      </span>
      <span
        className={cn(
          'inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-sm font-semibold',
          gradeTone(roundedAverage),
        )}
      >
        {roundedAverage}
      </span>
    </span>
  )
}
