import { useAuth } from '@/auth/auth-context'
import { useClass } from '@/features/classes/api'

/** The logged-in student's class with its subjects and teachers. */
export function useMyClass() {
  const { user } = useAuth()
  const classId = user?.student?.class?.id
  return {
    classId: classId ?? null,
    schoolClass: useClass(classId ?? '', { enabled: Boolean(classId) }),
  }
}
