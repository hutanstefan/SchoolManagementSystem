import { CalendarRange } from 'lucide-react'
import { Segmented } from '@/components/segmented'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePeriod } from './period-context'
import { startedSemesters } from './resolve'

/**
 * Picks the school year and semester all pages show: a year list and the
 * two semesters (one that hasn't started yet can't be picked).
 */
export function PeriodSwitcher({ className }: { className?: string }) {
  const period = usePeriod()
  const { year, semester, years } = period
  if (!year) return null
  const started = startedSemesters(year)

  return (
    <div
      className={cn(
        'rounded-xl border bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent p-3',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium">
          <CalendarRange className="text-primary size-4" aria-hidden />
          School year
        </p>
        {period.isCurrent ? (
          <Badge variant="success-soft" className="text-[10px]">
            Current
          </Badge>
        ) : period.isArchived ? (
          <Badge variant="secondary" className="text-[10px]">
            Archive
          </Badge>
        ) : (
          <Badge variant="warning-soft" className="text-[10px]">
            Ended
          </Badge>
        )}
      </div>
      <Select value={year.id} onValueChange={period.setYear}>
        <SelectTrigger
          size="sm"
          className="bg-background/70 w-full"
          aria-label="School year"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y.id} value={y.id}>
              {y.name}
              {y.status === 'ACTIVE' && (
                <span className="text-muted-foreground text-xs">· open</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Segmented
        label="Semester"
        size="sm"
        className="mt-2 w-full"
        value={semester}
        onChange={period.setSemester}
        options={([1, 2] as const).map((s) => ({
          value: s,
          label: `Semester ${s}`,
          disabled: !started.includes(s),
          title: started.includes(s)
            ? undefined
            : `Semester ${s} has not started yet`,
        }))}
      />
    </div>
  )
}
