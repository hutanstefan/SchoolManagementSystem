import type { LectureStudent } from './api'

export interface ClassGroup {
  /** The class id, or "none" for students without a class. */
  key: string
  name: string
  students: LectureStudent[]
}

/** Students in the order the API sends them (by class), grouped by class. */
export function groupByClass(students: LectureStudent[]): ClassGroup[] {
  const groups = new Map<string, ClassGroup>()
  for (const student of students) {
    const key = student.class?.id ?? 'none'
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        name: student.class ? `Class ${student.class.name}` : 'Not in a class',
        students: [],
      }
      groups.set(key, group)
    }
    group.students.push(student)
  }
  return [...groups.values()]
}

const fold = (text: string) =>
  text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Matches the name, the registration number or the class ("ana", "9a"). */
export function matchesSearch(
  student: LectureStudent,
  search: string,
): boolean {
  const words = fold(search).split(/\s+/).filter(Boolean)
  const haystack = fold(
    `${student.firstName} ${student.lastName} ${student.registrationNumber} ${student.class?.name ?? ''}`,
  )
  return words.every((word) => haystack.includes(word))
}

/** Adds or removes several students at once (a whole class). */
export function toggleMany(
  selected: ReadonlySet<string>,
  ids: string[],
  on: boolean,
): Set<string> {
  const next = new Set(selected)
  for (const id of ids) {
    if (on) next.add(id)
    else next.delete(id)
  }
  return next
}

/** Whether a group's checkbox is ticked, empty or half-ticked. */
export function groupState(
  students: LectureStudent[],
  selected: ReadonlySet<string>,
): boolean | 'indeterminate' {
  const count = students.filter((s) => selected.has(s.id)).length
  if (count === 0) return false
  return count === students.length ? true : 'indeterminate'
}
