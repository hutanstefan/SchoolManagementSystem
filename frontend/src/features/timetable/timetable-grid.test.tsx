import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/providers'
import type { Lesson, Timetable } from './api'
import { TimetableGrid } from './timetable-grid'

const lesson: Lesson = {
  id: 'l-1',
  day: 'MONDAY',
  period: 2,
  room: 'Lab 2',
  classSubjectId: 'cs-1',
  class: { id: 'c-1', name: '9A' },
  subject: { id: 's-1', name: 'Physics', color: 'VIOLET' },
  teacher: { id: 't-1', firstName: 'Aristita', lastName: 'David' },
}

const timetable: Timetable = {
  days: [
    { day: 'MONDAY', lessons: [lesson] },
    { day: 'TUESDAY', lessons: [] },
    { day: 'WEDNESDAY', lessons: [] },
    { day: 'THURSDAY', lessons: [] },
    { day: 'FRIDAY', lessons: [] },
  ],
}

describe('TimetableGrid', () => {
  it('shows the teacher in a class timetable and the class in a teacher one', () => {
    const { unmount } = renderWithProviders(
      <TimetableGrid timetable={timetable} mode="class" />,
    )
    expect(screen.getByText('Physics')).toBeInTheDocument()
    expect(screen.getByText(/Aristita David · Lab 2/)).toBeInTheDocument()
    unmount()

    renderWithProviders(<TimetableGrid timetable={timetable} mode="teacher" />)
    expect(screen.getByText(/Class 9A · Lab 2/)).toBeInTheDocument()
  })

  it('is read-only unless handlers are given', () => {
    renderWithProviders(<TimetableGrid timetable={timetable} mode="class" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // Read-only grids stop at period 4 when no lesson is later.
    expect(screen.queryByText('Period 5')).not.toBeInTheDocument()
  })

  it('reports clicks on empty slots and on lessons', () => {
    const onEmptyCellClick = vi.fn()
    const onLessonClick = vi.fn()
    renderWithProviders(
      <TimetableGrid
        timetable={timetable}
        mode="class"
        onEmptyCellClick={onEmptyCellClick}
        onLessonClick={onLessonClick}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Add a lesson on Friday, period 8',
      }),
    )
    expect(onEmptyCellClick).toHaveBeenCalledWith('FRIDAY', 8)

    fireEvent.click(screen.getByRole('button', { name: /Physics/ }))
    expect(onLessonClick).toHaveBeenCalledWith(lesson)
  })
})
