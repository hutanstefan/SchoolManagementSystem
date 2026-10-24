import type { SchoolClass } from '@/features/classes/api'
import type { TeacherDetail } from '@/features/teachers/api'
import type { SubjectColor } from '@/features/subjects/subject-colors'
import { compareClassNames } from '@/lib/format'

export interface TaughtSubject {
  id: string
  name: string
  color: SubjectColor
  hoursPerWeek: number
}

/** A class from the teacher's point of view. */
export interface TaughtClass {
  id: string
  name: string
  isHomeroom: boolean
  /** Subjects this teacher teaches in the class (may be empty for a homeroom class). */
  subjects: TaughtSubject[]
  /** From the class list; null while it is loading. */
  studentCount: number | null
}

/**
 * Turns the teacher's profile (one row per subject taught) into one entry per
 * class, including homeroom classes where they teach nothing.
 */
export function groupTeaching(
  profile: TeacherDetail,
  classes: SchoolClass[] = [],
): TaughtClass[] {
  const counts = new Map(classes.map((c) => [c.id, c.studentCount]))
  const homeroomIds = new Set(profile.homeroomClasses.map((c) => c.id))
  const byClass = new Map<string, TaughtClass>()

  const entry = (c: { id: string; name: string }): TaughtClass => {
    let item = byClass.get(c.id)
    if (!item) {
      item = {
        id: c.id,
        name: c.name,
        isHomeroom: homeroomIds.has(c.id),
        subjects: [],
        studentCount: counts.get(c.id) ?? null,
      }
      byClass.set(c.id, item)
    }
    return item
  }

  for (const assignment of profile.teaching) {
    entry(assignment.class).subjects.push({
      id: assignment.subject.id,
      name: assignment.subject.name,
      color: assignment.subject.color,
      hoursPerWeek: assignment.hoursPerWeek,
    })
  }
  for (const homeroom of profile.homeroomClasses) entry(homeroom)

  return [...byClass.values()].sort((a, b) => compareClassNames(a.name, b.name))
}
