/** Red below 5 (failing), green from 9, neutral in between. */
export function gradeTone(value: number): string {
  if (value < 5)
    return 'border-destructive/40 bg-destructive/10 text-destructive'
  if (value >= 9)
    return 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
  return 'border-border bg-background'
}
