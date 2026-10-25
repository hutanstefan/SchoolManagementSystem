import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClassSubject } from '@/features/classes/api'
import { renderWithProviders } from '@/test/providers'
import type { Gradebook as GradebookData } from './api'
import { Gradebook } from './gradebook'

const data: GradebookData = {
  class: { id: 'c-1', name: '9A' },
  period: {
    semester: 1,
    schoolYear: {
      id: 'y-1',
      startYear: 2026,
      name: '2026–2027',
      status: 'ACTIVE',
      currentSemester: 1,
      semester1EndedAt: null,
      closedAt: null,
    },
  },
  readOnly: false,
  subject: { id: 's-1', name: 'Mathematics', color: 'INDIGO', icon: 'BOOK' },
  teacher: { id: 't-1', firstName: 'Mihai', lastName: 'Ionescu' },
  hoursPerWeek: 4,
  minimumGrades: 5,
  maxAbsences: 14,
  canTakeAttendance: true,
  students: [
    {
      student: { id: 'st-1', firstName: 'Ana', lastName: 'Matei' },
      registrationNumber: '2026-0001',
      grades: [
        {
          id: 'g-own',
          value: 9,
          date: '2026-10-01',
          teacher: { id: 't-1', firstName: 'Mihai', lastName: 'Ionescu' },
        },
        {
          id: 'g-other',
          value: 4,
          date: '2026-10-02',
          teacher: { id: 't-2', firstName: 'Lili', lastName: 'Toth' },
        },
      ],
      average: 6.5,
      roundedAverage: 7,
      hasMinimumGrades: false,
      absences: { unexcused: 12, excused: 1 },
    },
  ],
}

vi.mock('./api', async (importActual) => ({
  ...(await importActual<typeof import('./api')>()),
  useGradebook: () => ({ data, isPending: false, error: null }),
}))

const subjects: ClassSubject[] = [
  {
    classSubjectId: 'cs-1',
    subject: { id: 's-1', name: 'Mathematics', color: 'INDIGO', icon: 'BOOK' },
    teacher: { id: 't-1', firstName: 'Mihai', lastName: 'Ionescu' },
    hoursPerWeek: 4,
    maxAbsences: 14,
  },
]

describe('Gradebook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows grades, the average and a warning about missing grades', () => {
    renderWithProviders(
      <Gradebook
        classId="c-1"
        subjects={subjects}
        canAddGrades={() => false}
        canEditGrade={() => false}
      />,
    )
    expect(screen.getByText('Ana Matei')).toBeInTheDocument()
    expect(screen.getAllByText('6.50')[0]).toBeInTheDocument()
    expect(screen.getAllByLabelText('Not enough grades')[0]).toBeInTheDocument()
    expect(screen.getByText('min. 5 grades')).toBeInTheDocument()
  })

  it('lets a teacher edit only their own grades', () => {
    renderWithProviders(
      <Gradebook
        classId="c-1"
        subjects={subjects}
        canAddGrades={() => true}
        canEditGrade={(grade) => grade.teacher?.id === 't-1'}
      />,
    )
    expect(
      screen.getByRole('button', { name: /Edit grade 9/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Edit grade 4/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add a grade for Ana Matei' }),
    ).toBeInTheDocument()
  })

  it('hides the add button when grades cannot be added', () => {
    renderWithProviders(
      <Gradebook
        classId="c-1"
        subjects={subjects}
        canAddGrades={() => false}
        canEditGrade={() => true}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /Add a grade/ }),
    ).not.toBeInTheDocument()
  })

  it('shows the absences against the limit, and takes attendance', async () => {
    renderWithProviders(
      <Gradebook
        classId="c-1"
        subjects={subjects}
        canAddGrades={() => true}
        canEditGrade={() => true}
      />,
    )
    expect(screen.getByText('max. 14 absences')).toBeInTheDocument()
    const [count] = screen.getAllByRole('button', {
      name: 'Absences of Ana Matei',
    })
    expect(count).toHaveTextContent('12/14')
    expect(count).toHaveTextContent('+1 exc.')

    await userEvent.click(
      screen.getByRole('button', { name: /Take attendance/ }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Everyone is present')
    await userEvent.click(screen.getByRole('checkbox'))
    expect(dialog).toHaveTextContent('1 absent of 1')
    expect(screen.getByRole('button', { name: 'Mark 1 absent' })).toBeEnabled()
  })
})
