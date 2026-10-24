import { describe, expect, it } from 'vitest'
import { describeClass } from './class-label'

describe('describeClass', () => {
  it('splits a class name into grade and section', () => {
    expect(describeClass({ name: '9A', gradeLevel: 9 })).toEqual({
      title: 'Grade 9',
      section: 'A',
    })
    expect(describeClass({ name: '12 B', gradeLevel: 12 })).toEqual({
      title: 'Grade 12',
      section: 'B',
    })
    expect(describeClass({ name: '10', gradeLevel: 10 })).toEqual({
      title: 'Grade 10',
      section: null,
    })
  })

  it('keeps names without a grade level', () => {
    expect(describeClass({ name: 'Robotics', gradeLevel: null })).toEqual({
      title: 'Robotics',
      section: null,
    })
  })
})
