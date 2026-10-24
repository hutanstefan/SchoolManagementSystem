import { screen } from '@testing-library/react'
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
  subject: { id: 's-1', name: 'Mathematics', color: 'INDIGO' },
  teacher: { id: 't-1', firstName: 'Mihai', lastName: 'Ionescu' },
  hoursPerWeek: 4,
  minimumGrades: 5,
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
    subject: { id: 's-1', name: 'Mathematics', color: 'INDIGO' },
    teacher: { id: 't-1', firstName: 'Mihai', lastName: 'Ionescu' },
    hoursPerWeek: 4,
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
    expect(screen.getByText('6.50')).toBeInTheDocument()
    expect(screen.getByLabelText('Not enough grades')).toBeInTheDocument()
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
})
