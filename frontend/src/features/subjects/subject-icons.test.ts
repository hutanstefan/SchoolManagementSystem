import { describe, expect, it } from 'vitest'
import { iconForName, nextIconIndex, SUBJECT_ICON_KEYS } from './subject-icons'

describe('iconForName', () => {
  it.each([
    ['Mathematics', 'CALCULATOR'],
    ['Computer Science', 'LAPTOP'],
    ['Biology', 'DNA'],
    ['Romanian Language and Literature', 'FEATHER'],
    ['German', 'LANGUAGES'],
    ['Physical Education', 'DUMBBELL'],
    ['Something else', 'BOOK'],
  ] as const)('%s gets %s', (name, icon) => {
    expect(iconForName(name)).toBe(icon)
  })
})

describe('nextIconIndex', () => {
  const count = SUBJECT_ICON_KEYS.length // 40: five full rows of 8

  it('moves along the row and wraps at the ends', () => {
    expect(nextIconIndex(0, 'ArrowRight', count)).toBe(1)
    expect(nextIconIndex(0, 'ArrowLeft', count)).toBe(count - 1)
    expect(nextIconIndex(count - 1, 'ArrowRight', count)).toBe(0)
  })

  it('moves between rows and wraps to the other end of the column', () => {
    expect(nextIconIndex(3, 'ArrowDown', count)).toBe(11)
    expect(nextIconIndex(35, 'ArrowDown', count)).toBe(3)
    expect(nextIconIndex(3, 'ArrowUp', count)).toBe(35)
  })

  it('handles a last row that is not full', () => {
    // 10 icons: row 0 = 0..7, row 1 = 8..9
    expect(nextIconIndex(5, 'ArrowUp', 10)).toBe(5) // column 5 has no second row
    expect(nextIconIndex(1, 'ArrowUp', 10)).toBe(9)
    expect(nextIconIndex(9, 'ArrowDown', 10)).toBe(1)
  })

  it('ignores other keys', () => {
    expect(nextIconIndex(4, 'a', count)).toBeNull()
    expect(nextIconIndex(4, 'Home', count)).toBe(0)
    expect(nextIconIndex(4, 'End', count)).toBe(count - 1)
  })
})
