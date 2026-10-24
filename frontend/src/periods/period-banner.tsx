import { Archive, History, Undo2 } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { usePeriod } from './period-context'
import { periodLabel } from './resolve'

/**
 * Says when the pages show another period than the current one, and what
 * can still be changed there.
 */
export function PeriodBanner() {
  const { user } = useAuth()
  const period = usePeriod()
  if (period.isCurrent || !period.year) return null

  const label = periodLabel(period.year, period.semester)
  const Icon = period.isArchived ? Archive : History
  const note = period.isArchived
    ? 'This school year is closed: everything here can only be viewed.'
    : user?.role === 'ADMIN'
      ? 'This semester has ended: only you, as an administrator, can still correct its grades.'
      : 'This semester has ended: its grades can no longer be changed.'

  return (
    <div
      role="status"
      className="rise mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">You are viewing {label}</p>
        <p className="text-muted-foreground">{note}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-start sm:self-auto"
        onClick={period.reset}
      >
        <Undo2 aria-hidden />
        Back to current
      </Button>
    </div>
  )
}
