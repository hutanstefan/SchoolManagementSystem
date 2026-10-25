import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Segmented } from '@/components/segmented'
import {
  PERIODS,
  WEEKDAYS,
  WEEKDAY_LABEL,
  fullName,
  periodTime,
  todayWeekday,
  type Weekday,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Lesson, Timetable } from './api'
import { SUBJECT_COLORS } from '@/features/subjects/subject-colors'
import { SubjectDot } from '@/features/subjects/subject-icon'

/**
 * The week as a grid: days across, periods down.
 * - mode "class": each lesson shows its subject and teacher
 * - mode "teacher": each lesson shows its subject and class
 * Pass the click handlers to make it editable.
 * Where the week doesn't fit (phones, narrow panels) it shows one day at a
 * time, with the days to pick from above.
 */
export function TimetableGrid({
  timetable,
  mode,
  onEmptyCellClick,
  onLessonClick,
}: {
  timetable: Timetable
  mode: 'class' | 'teacher'
  onEmptyCellClick?: (day: Weekday, period: number) => void
  onLessonClick?: (lesson: Lesson) => void
}) {
  const lessons = new Map<string, Lesson>()
  for (const day of timetable.days) {
    for (const lesson of day.lessons) {
      lessons.set(`${day.day}-${lesson.period}`, lesson)
    }
  }

  // Editable grids show every period; read-only ones stop after the last lesson.
  const lastUsed = Math.max(0, ...[...lessons.values()].map((l) => l.period))
  const periods = onEmptyCellClick
    ? PERIODS
    : PERIODS.filter((p) => p <= Math.max(lastUsed, 4))
  const today = todayWeekday()
  const [day, setDay] = useState<Weekday>(today ?? 'MONDAY')

  const slot = (day: Weekday, period: number) => {
    const lesson = lessons.get(`${day}-${period}`)
    return lesson ? (
      <LessonCard
        lesson={lesson}
        mode={mode}
        onClick={onLessonClick ? () => onLessonClick(lesson) : undefined}
      />
    ) : onEmptyCellClick ? (
      <button
        type="button"
        onClick={() => onEmptyCellClick(day, period)}
        className="text-muted-foreground hover:border-primary/50 hover:text-foreground flex size-full min-h-14 items-center justify-center rounded-md border border-dashed opacity-60 transition hover:opacity-100"
        aria-label={`Add a lesson on ${WEEKDAY_LABEL[day]}, period ${period}`}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    ) : null
  }

  return (
    <div className="@container">
      <div className="@2xl:hidden" data-testid="timetable-day">
        <Segmented
          label="Day"
          size="sm"
          className="mb-2 flex w-full"
          value={day}
          onChange={setDay}
          options={WEEKDAYS.map((d) => ({
            value: d,
            label: WEEKDAY_LABEL[d].slice(0, 3),
            title: d === today ? 'Today' : WEEKDAY_LABEL[d],
          }))}
        />
        <ul className="divide-y">
          {periods.map((period) => (
            <li key={period} className="flex gap-3 py-1">
              <div className="w-20 shrink-0 py-1.5 text-sm">
                <div className="font-medium">Period {period}</div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  {periodTime(period)}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                {slot(day, period) ?? (
                  <span className="text-muted-foreground flex h-full items-center text-xs">
                    Free
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="hidden overflow-x-auto @2xl:block">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-24 p-2 text-left font-medium" scope="col">
                <span className="sr-only">Period</span>
              </th>
              {WEEKDAYS.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className={cn(
                    'p-2 text-left font-medium',
                    day === today && 'text-primary',
                  )}
                >
                  {WEEKDAY_LABEL[day]}
                  {day === today && (
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      today
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period} className="border-t">
                <th scope="row" className="p-2 text-left align-top font-normal">
                  <div className="font-medium">Period {period}</div>
                  <div className="text-muted-foreground text-xs tabular-nums">
                    {periodTime(period)}
                  </div>
                </th>
                {WEEKDAYS.map((day) => (
                  <td key={day} className="h-16 p-1 align-top">
                    {slot(day, period)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LessonCard({
  lesson,
  mode,
  onClick,
}: {
  lesson: Lesson
  mode: 'class' | 'teacher'
  onClick?: () => void
}) {
  const secondary =
    mode === 'class'
      ? lesson.teacher
        ? fullName(lesson.teacher)
        : 'No teacher'
      : `Class ${lesson.class.name}`

  const content = (
    <>
      <span className="flex items-center gap-1.5 font-medium">
        <SubjectDot color={lesson.subject.color} />
        <span className="truncate">{lesson.subject.name}</span>
      </span>
      <span className="text-muted-foreground block truncate text-xs">
        {secondary}
        {lesson.room && ` · ${lesson.room}`}
      </span>
    </>
  )
  const className = cn(
    'block size-full min-h-14 rounded-md border px-2 py-1.5 text-left transition',
    SUBJECT_COLORS[lesson.subject.color].card,
  )

  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}
