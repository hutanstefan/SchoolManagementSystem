import type { Schemas } from '@/api/client'

export type SubjectColor = Schemas['SubjectColor']

interface ColorClasses {
  label: string
  /** Soft tile: tinted background, strong icon. */
  tile: string
  /** Solid swatch (dots, bars). */
  solid: string
  /** Lesson cards in timetables. */
  card: string
}

/**
 * The colours an admin can give a subject. Class names are spelled out so
 * Tailwind finds them.
 */
export const SUBJECT_COLORS: Record<SubjectColor, ColorClasses> = {
  INDIGO: {
    label: 'Indigo',
    tile: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
    solid: 'bg-indigo-500',
    card: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20',
  },
  VIOLET: {
    label: 'Violet',
    tile: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    solid: 'bg-violet-500',
    card: 'bg-violet-50 border-violet-200 hover:bg-violet-100 dark:border-violet-500/25 dark:bg-violet-500/10 dark:hover:bg-violet-500/20',
  },
  PINK: {
    label: 'Pink',
    tile: 'bg-pink-500/10 text-pink-600 dark:text-pink-300',
    solid: 'bg-pink-500',
    card: 'bg-pink-50 border-pink-200 hover:bg-pink-100 dark:border-pink-500/25 dark:bg-pink-500/10 dark:hover:bg-pink-500/20',
  },
  ROSE: {
    label: 'Rose',
    tile: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    solid: 'bg-rose-500',
    card: 'bg-rose-50 border-rose-200 hover:bg-rose-100 dark:border-rose-500/25 dark:bg-rose-500/10 dark:hover:bg-rose-500/20',
  },
  ORANGE: {
    label: 'Orange',
    tile: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
    solid: 'bg-orange-500',
    card: 'bg-orange-50 border-orange-200 hover:bg-orange-100 dark:border-orange-500/25 dark:bg-orange-500/10 dark:hover:bg-orange-500/20',
  },
  AMBER: {
    label: 'Amber',
    tile: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    solid: 'bg-amber-500',
    card: 'bg-amber-50 border-amber-200 hover:bg-amber-100 dark:border-amber-500/25 dark:bg-amber-500/10 dark:hover:bg-amber-500/20',
  },
  LIME: {
    label: 'Lime',
    tile: 'bg-lime-500/10 text-lime-700 dark:text-lime-300',
    solid: 'bg-lime-500',
    card: 'bg-lime-50 border-lime-200 hover:bg-lime-100 dark:border-lime-500/25 dark:bg-lime-500/10 dark:hover:bg-lime-500/20',
  },
  EMERALD: {
    label: 'Emerald',
    tile: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    solid: 'bg-emerald-500',
    card: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20',
  },
  TEAL: {
    label: 'Teal',
    tile: 'bg-teal-500/10 text-teal-600 dark:text-teal-300',
    solid: 'bg-teal-500',
    card: 'bg-teal-50 border-teal-200 hover:bg-teal-100 dark:border-teal-500/25 dark:bg-teal-500/10 dark:hover:bg-teal-500/20',
  },
  SKY: {
    label: 'Sky',
    tile: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    solid: 'bg-sky-500',
    card: 'bg-sky-50 border-sky-200 hover:bg-sky-100 dark:border-sky-500/25 dark:bg-sky-500/10 dark:hover:bg-sky-500/20',
  },
}

export const SUBJECT_COLOR_KEYS = Object.keys(SUBJECT_COLORS) as SubjectColor[]
