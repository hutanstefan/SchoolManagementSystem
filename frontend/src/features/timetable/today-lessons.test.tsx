import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/providers'
import type { Lesson, Timetable } from './api'
import { TodayLessons } from './today-lessons'

const lesson = (period: number, subject: string): Lesson => ({
  id: `l-${period}`,
  day: 'TUESDAY',
  period,
  room: null,
  classSubjectId: `cs-${period}`,
  class: { id: 'c-1', name: '9A' },
  subject: { id: `s-${period}`, name: subject, color: 'INDIGO' },
  teacher: { id: 't-1', firstName: 'Ana', lastName: 'Pop' },
})

const timetable: Timetable = {
  days: [
    { day: 'MONDAY', lessons: [{ ...lesson(1, 'History'), day: 'MONDAY' }] },
    {
      day: 'TUESDAY',
      lessons: [lesson(1, 'Mathematics'), lesson(2, 'Physics')],
    },
    { day: 'WEDNESDAY', lessons: [] },
    { day: 'THURSDAY', lessons: [] },
    { day: 'FRIDAY', lessons: [] },
  ],
}

describe('TodayLessons', () => {
  it("lists today's lessons and marks the one in progress", () => {
    // Tuesday 20 October 2026, 09:15 (period 2)
    renderWithProviders(
      <TodayLessons
        timetable={timetable}
        mode="class"
        now={new Date(2026, 9, 20, 9, 15)}
      />,
    )

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[1]).toHaveAttribute('aria-current', 'true')
    expect(within(items[1]!).getByText('Now')).toBeInTheDocument()
    expect(within(items[0]!).queryByText('Now')).not.toBeInTheDocument()
    expect(screen.getAllByText(/Ana Pop/)).toHaveLength(2)
  })

  it("shows Monday's lessons at the weekend", () => {
    // Sunday 18 October 2026
    renderWithProviders(
      <TodayLessons
        timetable={timetable}
        mode="teacher"
        now={new Date(2026, 9, 18, 10, 0)}
      />,
    )

    expect(screen.getByText(/It's the weekend/)).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.getByText(/Class 9A/)).toBeInTheDocument()
    expect(screen.queryByText('Now')).not.toBeInTheDocument()
  })
})
