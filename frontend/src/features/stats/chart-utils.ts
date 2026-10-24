/** Averages under this fail the subject (Romanian grading, 1 to 10). */
export const PASSING_GRADE = 5

/** Round axis ticks (0, 100, 200…) for a count axis that goes up to `max`. */
export function countTicks(max: number, intervals = 4): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / intervals
  const power = 10 ** Math.floor(Math.log10(raw))
  // Counts are whole numbers, so no 2.5 steps under 10.
  const multipliers = power >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10]
  const step = Math.max(
    1,
    multipliers.map((m) => m * power).find((s) => s >= raw) ?? 10 * power,
  )
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}
