import type { ClassDetail } from './api'

type Year = { id: string; name: string }

export type ClassInYear =
  /** The class belongs to the picked year (or nothing to compare yet). */
  | { status: 'same' }
  /** The same class in the picked year: show that one instead. */
  | { status: 'moved'; classId: string }
  /** The class didn't exist in the picked year (or the user can't see it). */
  | { status: 'missing'; year: Year }

/**
 * A class page follows the year picked in the sidebar: last year's 9A is
 * this year's 10A (`lineage`). Without this, picking another year would keep
 * showing the old class's students and grades.
 */
export function classInYear(
  schoolClass: Pick<ClassDetail, 'schoolYear' | 'lineage'> | undefined,
  picked: Year | undefined,
): ClassInYear {
  if (!schoolClass || !picked || schoolClass.schoolYear.id === picked.id) {
    return { status: 'same' }
  }
  const twin = schoolClass.lineage.find((c) => c.schoolYear.id === picked.id)
  return twin
    ? { status: 'moved', classId: twin.id }
    : { status: 'missing', year: picked }
}
