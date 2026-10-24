import type { TrendPoint } from './charts'

/**
 * The mean of all grades received up to each date (one point per date with
 * grades). An indication of progress, not the official average, which is
 * computed per subject.
 */
export function averageTrend(
  grades: { value: number; date: string }[],
): TrendPoint[] {
  const byDate = new Map<string, number[]>()
  for (const grade of grades) {
    const day = grade.date.slice(0, 10)
    byDate.set(day, [...(byDate.get(day) ?? []), grade.value])
  }
  let sum = 0
  let count = 0
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => {
      sum += values.reduce((a, b) => a + b, 0)
      count += values.length
      return { date, average: Math.round((sum / count) * 100) / 100 }
    })
}
