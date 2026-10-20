import type { Schemas } from '@/api/client'

export type Role = Schemas['Role']
export type AuthUser = Schemas['AuthUserDto']

/** Where each role lands after logging in. */
export const HOME_PATH: Record<Role, string> = {
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
}
