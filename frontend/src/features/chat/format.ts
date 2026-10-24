import type { ChatUser, Conversation, Message } from './api'

/** "14:05" today, "Yesterday", "Mon" this week, else "17 Oct". */
export function formatListTime(value: string, now: Date = new Date()): string {
  const date = new Date(value)
  const days = dayDifference(date, now)
  if (days === 0) return formatClock(date)
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString('en-GB', { weekday: 'short' })
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  })
}

/** The separator above the first message of a day: "Today", "Monday 20 October". */
export function formatDayLabel(value: string, now: Date = new Date()): string {
  const date = new Date(value)
  const days = dayDifference(date, now)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  })
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Whole calendar days between two dates (local time). */
function dayDifference(date: Date, now: Date): number {
  const start = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((start(now) - start(date)) / 86_400_000)
}

export function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

/** Messages of one sender a few minutes apart are drawn as one block. */
export function startsBlock(previous: Message | undefined, message: Message) {
  return (
    !previous ||
    previous.kind === 'SYSTEM' ||
    message.kind === 'SYSTEM' ||
    previous.sender?.id !== message.sender?.id ||
    !sameDay(previous.createdAt, message.createdAt) ||
    new Date(message.createdAt).getTime() -
      new Date(previous.createdAt).getTime() >
      5 * 60_000
  )
}

export { initials } from '@/lib/format'

/** "You: See you", "Ana: Thanks", or just the text in a direct conversation. */
export function previewOf(
  conversation: Conversation,
  myId: string | undefined,
): string {
  const message = conversation.lastMessage
  if (!message) return 'No messages yet'
  if (message.deletedAt) return 'Message deleted'
  if (message.kind === 'SYSTEM') return message.body
  const who =
    message.sender?.id === myId
      ? 'You: '
      : conversation.type === 'GROUP' && message.sender
        ? `${message.sender.firstName}: `
        : ''
  return who + message.body
}

/** "Student · 9A" or "Teacher". */
export function describeUser(user: ChatUser): string {
  if (user.role !== 'STUDENT') return 'Teacher'
  return user.class ? `Student · ${user.class.name}` : 'Student'
}
