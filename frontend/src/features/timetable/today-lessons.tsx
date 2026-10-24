import { CalendarCheck } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { useNow } from '@/hooks/use-now'
import {
  WEEKDAY_LABEL,
  currentPeriod,
  fullName,
  isPeriodOver,
  periodTime,
  todayWeekday,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Timetable } from './api'
import { SubjectDot } from '@/features/subjects/subject-icon'

/**
 * Today's lessons as a list, with the current one highlighted and the finished
 * ones dimmed. At the weekend it shows Monday's lessons instead.
 * - mode "class": each lesson shows its teacher (for students)
 * - mode "teacher": each lesson shows its class (for teachers)
 */
export function TodayLessons({
  timetable,
  mode,
  classLink,
  now: fixedNow,
}: {
  timetable: Timetable
  mode: 'class' | 'teacher'
  /** Makes the class name a link (teacher mode). */
  classLink?: (classId: string) => string
  /** For tests; by default the clock ticks every minute. */
  now?: Date
}) {
  const liveNow = useNow()
  const now = fixedNow ?? liveNow
  const today = todayWeekday(now)
  const day = today ?? 'MONDAY'
  const lessons = timetable.days.find((d) => d.day === day)?.lessons ?? []
  const nowPeriod = today ? currentPeriod(now) : null

  return (
    <div>
      {!today && (
        <p className="text-muted-foreground border-b px-4 py-2 text-sm">
          It's the weekend. Here is {WEEKDAY_LABEL[day]}'s schedule.
        </p>
      )}
      {lessons.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No lessons"
          description={`Nothing scheduled on ${WEEKDAY_LABEL[day]}.`}
        />
      ) : (
        <ol
          className="divide-y"
          aria-label={`Lessons on ${WEEKDAY_LABEL[day]}`}
        >
          {lessons.map((lesson) => {
            const isNow = lesson.period === nowPeriod
            const isOver = today !== null && isPeriodOver(lesson.period, now)
            return (
              <li
                key={lesson.id}
                aria-current={isNow ? 'true' : undefined}
                className={cn(
                  'flex items-center gap-3 px-4 py-3',
                  isNow && 'bg-primary/5',
                  isOver && !isNow && 'opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md border text-sm font-semibold tabular-nums',
                    isNow &&
                      'border-primary bg-primary text-primary-foreground',
                  )}
                  aria-label={`Period ${lesson.period}`}
                >
                  {lesson.period}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <SubjectDot color={lesson.subject.color} />
                    <span className="truncate">{lesson.subject.name}</span>
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    <span className="tabular-nums">
                      {periodTime(lesson.period)}
                    </span>
                    {' · '}
                    {mode === 'teacher' ? (
                      classLink ? (
                        <Link
                          to={classLink(lesson.class.id)}
                          className="hover:text-foreground hover:underline"
                        >
                          Class {lesson.class.name}
                        </Link>
                      ) : (
                        `Class ${lesson.class.name}`
                      )
                    ) : lesson.teacher ? (
                      fullName(lesson.teacher)
                    ) : (
                      'No teacher'
                    )}
                    {lesson.room && ` · ${lesson.room}`}
                  </p>
                </div>
                {isNow && <Badge>Now</Badge>}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
