export type Tone = 'indigo' | 'violet' | 'sky' | 'emerald' | 'amber' | 'rose'

/** Icon colours per tone (soft background, strong icon). */
export const TONE_CLASSES: Record<Tone, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
}

const TONES = Object.keys(TONE_CLASSES) as Tone[]

/** A stable tone for a name: the same person or subject keeps its colour. */
export function toneFor(key: string): Tone {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return TONES[Math.abs(hash) % TONES.length]!
}
