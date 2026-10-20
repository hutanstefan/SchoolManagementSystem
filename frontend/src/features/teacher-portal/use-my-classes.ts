import { useAllClasses } from '@/features/classes/api'
import { useMyTeacherProfile } from '@/features/teachers/api'
import { groupTeaching } from './teaching'

/** The logged-in teacher's profile and their classes, grouped per class. */
export function useMyClasses() {
  const profile = useMyTeacherProfile()
  // For a teacher the API returns only the classes they are assigned to.
  const classes = useAllClasses()

  return {
    profile,
    classes,
    taught: profile.data ? groupTeaching(profile.data, classes.data?.data) : [],
  }
}
