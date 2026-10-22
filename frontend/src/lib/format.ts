import type { Schemas } from '@/api/client'

type Person = { firstName: string; lastName: string }

export function fullName(person: Person | null | undefined): string {
  return person ? `${person.firstName} ${person.lastName}` : '—'
}

/** "2026-10-20" -> "20 Oct 2026" (date-only values, no time zone shift). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString(
    'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
  )
}

/** Two decimals, as shown in Romanian report cards: 8.5 -> "8.50". */
export function formatAverage(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toFixed(2)
}

export type Weekday = Schemas['Weekday']

export const WEEKDAYS: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
]

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
}

/** Today's weekday, or null at the weekend. */
export function todayWeekday(now: Date = new Date()): Weekday | null {
  const index = now.getDay() // 0 = Sunday
  return index >= 1 && index <= 5 ? WEEKDAYS[index - 1]! : null
}

/** Today's date as YYYY-MM-DD in the browser's time zone. */
export function todayIso(now: Date = new Date()): string {
  return now.toLocaleDateString('sv-SE')
}

export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const

/** Start of a period in minutes after midnight (period 1 starts at 08:00). */
function periodStart(period: number): number {
  return (7 + period) * 60
}

/** The period being taught at `now` (breaks don't count), or null. */
export function currentPeriod(now: Date = new Date()): number | null {
  const minutes = now.getHours() * 60 + now.getMinutes()
  return (
    PERIODS.find(
      (period) =>
        minutes >= periodStart(period) && minutes < periodStart(period) + 50,
    ) ?? null
  )
}

/** True once a period is over on the current day. */
export function isPeriodOver(period: number, now: Date = new Date()): boolean {
  return now.getHours() * 60 + now.getMinutes() >= periodStart(period) + 50
}

/** "Tuesday 20 October" */
export function formatLongDate(now: Date = new Date()): string {
  return now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Natural order for class names: "9A" before "10A". */
export function compareClassNames(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true })
}

/**
 * Display times for a period: lessons start at 08:00 and last 50 minutes,
 * followed by a 10 minute break (the usual Romanian school day).
 */
export function periodTime(period: number): string {
  const start = 7 + period
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(start)}:00–${pad(start)}:50`
}

/**
 * How long ago something happened, for notifications: "just now",
 * "5 min ago", "3 h ago", "yesterday", "17 Oct" (this year) or "17 Oct 2025".
 */
export function formatTimeAgo(value: string, now: Date = new Date()): string {
  const then = new Date(value)
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24 && then.getDate() === now.getDate()) return `${hours} h ago`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (then.toDateString() === yesterday.toDateString()) return 'yesterday'

  return then.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(then.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  })
}
