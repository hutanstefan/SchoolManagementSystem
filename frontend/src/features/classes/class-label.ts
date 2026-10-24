/**
 * "9A" → "Grade 9", section "A"; a name without a grade level (e.g. "Robotics
 * club") is kept as it is.
 */
export function describeClass(c: { name: string; gradeLevel: number | null }): {
  title: string
  section: string | null
} {
  if (c.gradeLevel === null) return { title: c.name, section: null }
  const section = c.name
    .slice(String(c.gradeLevel).length)
    .replace(/^[\s-]+/, '')
  return { title: `Grade ${c.gradeLevel}`, section: section || null }
}
