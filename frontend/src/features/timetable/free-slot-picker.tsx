import { LoadingBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { WEEKDAYS, WEEKDAY_LABEL, periodTime, type Weekday } from '@/lib/format'
import { useFreeSlots } from './api'

export interface Slot {
  day: Weekday
  period: number
}

/** The free slots of a subject (class and teacher both free), by day. */
export function FreeSlotPicker({
  classSubjectId,
  excludeLessonId,
  value,
  onChange,
}: {
  classSubjectId: string
  /** The lesson being moved, so its own slot counts as free. */
  excludeLessonId?: string
  value: Slot | null
  onChange: (slot: Slot) => void
}) {
  const slots = useFreeSlots(classSubjectId, excludeLessonId)
  if (slots.isPending) return <LoadingBlock rows={2} />
  if (!slots.data || slots.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No free slot this week: the class or the teacher is busy in every
        period.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Free slots">
      {WEEKDAYS.map((day) => {
        const periods = slots.data
          .filter((slot) => slot.day === day)
          .map((slot) => slot.period)
        if (periods.length === 0) return null
        return (
          <div key={day} className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground w-24 text-sm">
              {WEEKDAY_LABEL[day]}
            </span>
            {periods.map((period) => {
              const selected = value?.day === day && value.period === period
              return (
                <Button
                  key={period}
                  type="button"
                  size="sm"
                  variant={selected ? 'default' : 'outline'}
                  className="h-7 min-w-8 px-2 tabular-nums"
                  title={periodTime(period)}
                  aria-label={`${WEEKDAY_LABEL[day]}, period ${period}`}
                  aria-pressed={selected}
                  onClick={() => onChange({ day, period })}
                >
                  {period}
                </Button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
