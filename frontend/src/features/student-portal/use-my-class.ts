import { useClass, useClasses } from '@/features/classes/api'

/**
 * The logged-in student's class in the picked school year, with its
 * subjects and teachers. (A student is only shown their own class.)
 */
export function useMyClass() {
  const classes = useClasses({ pageSize: 1 })
  const classId = classes.data?.data[0]?.id ?? null
  return {
    classId,
    /** Still finding out which class it is. */
    isPending: classes.isPending,
    schoolClass: useClass(classId ?? '', { enabled: Boolean(classId) }),
  }
}
