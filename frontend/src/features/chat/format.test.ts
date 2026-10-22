import { describe, expect, it } from 'vitest'
import type { Message } from './api'
import { formatDayLabel, formatListTime, startsBlock } from './format'

const now = new Date(2026, 9, 22, 15, 0)
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).toISOString()

const message = (createdAt: string, senderId = 'u1'): Message => ({
  id: createdAt,
  conversationId: 'c',
  kind: 'TEXT',
  body: 'hi',
  sender: { id: senderId, firstName: 'A', lastName: 'B' },
  createdAt,
  deletedAt: null,
})

describe('chat formatting', () => {
  it('shows times in the list like a messaging app', () => {
    expect(formatListTime(at(22, 9, 5), now)).toBe('09:05')
    expect(formatListTime(at(21, 23), now)).toBe('Yesterday')
    expect(formatListTime(at(19, 10), now)).toBe('Mon')
    expect(formatListTime(at(2, 10), now)).toBe('2 Oct')
  })

  it('labels days in the thread', () => {
    expect(formatDayLabel(at(22, 8), now)).toBe('Today')
    expect(formatDayLabel(at(21, 8), now)).toBe('Yesterday')
    expect(formatDayLabel(at(20, 8), now)).toBe('Tuesday 20 October')
  })

  it('groups messages of one sender written close together', () => {
    const first = message(at(22, 10, 0))
    expect(startsBlock(undefined, first)).toBe(true)
    expect(startsBlock(first, message(at(22, 10, 3)))).toBe(false)
    expect(startsBlock(first, message(at(22, 10, 9)))).toBe(true)
    expect(startsBlock(first, message(at(22, 10, 1), 'u2'))).toBe(true)
  })
})
