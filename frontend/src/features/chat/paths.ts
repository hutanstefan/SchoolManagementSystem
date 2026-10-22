import type { Role } from '@/auth/roles'

const AREA: Record<Role, string> = {
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
}

/** /teacher/messages, or /teacher/messages/<id> for one conversation. */
export function messagesPath(role: Role, conversationId?: string): string {
  return `${AREA[role]}/messages${conversationId ? `/${conversationId}` : ''}`
}
