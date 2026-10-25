import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AbsenceCount } from './api'
import { absenceStatus, absenceSummary, type AbsenceStatus } from './limits'

const TONE: Record<AbsenceStatus, string> = {
  ok: 'bg-muted text-foreground',
  near: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  over: 'bg-destructive/10 text-destructive dark:text-red-300',
}

/**
 * Absences in a subject: unexcused out of the limit, coloured when close to
 * or over it, with the excused ones next to it. A button when `onClick` is set.
 */
export function AbsenceCountCell({
  count,
  maxAbsences,
  onClick,
  label,
}: {
  count: AbsenceCount
  maxAbsences: number | null
  onClick?: () => void
  /** Accessible name of the button, e.g. "Absences of Ana Pop". */
  label?: string
}) {
  const status = absenceStatus(count.unexcused, maxAbsences)
  const empty = count.unexcused === 0 && count.excused === 0
  const content = (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex h-6 min-w-10 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums',
          empty ? 'text-muted-foreground bg-transparent' : TONE[status],
        )}
      >
        {count.unexcused}
        {maxAbsences !== null && (
          <span className="font-normal opacity-60">/{maxAbsences}</span>
        )}
      </span>
      {count.excused > 0 && (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          +{count.excused} exc.
        </span>
      )}
    </span>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="hover:bg-accent focus-visible:ring-ring/50 -mx-1 rounded-full px-1 py-0.5 outline-none focus-visible:ring-2"
          >
            {content}
          </button>
        ) : (
          <span tabIndex={0} className="outline-none">
            {content}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{absenceSummary(count, maxAbsences)}</TooltipContent>
    </Tooltip>
  )
}
