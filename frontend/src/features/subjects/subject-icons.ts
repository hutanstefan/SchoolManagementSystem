import {
  Atom,
  BookOpen,
  Brain,
  Calculator,
  Camera,
  Church,
  Code,
  Compass,
  Cpu,
  Dna,
  Drama,
  Dumbbell,
  Feather,
  FlaskConical,
  Globe2,
  GraduationCap,
  HeartPulse,
  Landmark,
  Languages,
  Laptop,
  Leaf,
  Lightbulb,
  Magnet,
  MessageCircle,
  Microscope,
  Mountain,
  Music,
  Palette,
  Pencil,
  Pi,
  Puzzle,
  Ruler,
  Scale,
  Scroll,
  Shapes,
  Sigma,
  Telescope,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { Schemas } from '@/api/client'

export type SubjectIconName = Schemas['SubjectIcon']

/**
 * Every icon an admin can give a subject, in the order the picker shows
 * them (grouped loosely: maths, sciences, humanities, languages, tech, arts,
 * the rest).
 */
export const SUBJECT_ICONS: Record<
  SubjectIconName,
  { icon: LucideIcon; label: string }
> = {
  BOOK: { icon: BookOpen, label: 'Book' },
  CALCULATOR: { icon: Calculator, label: 'Calculator' },
  SIGMA: { icon: Sigma, label: 'Sigma' },
  PI: { icon: Pi, label: 'Pi' },
  RULER: { icon: Ruler, label: 'Ruler' },
  SHAPES: { icon: Shapes, label: 'Shapes' },
  PUZZLE: { icon: Puzzle, label: 'Puzzle' },
  ATOM: { icon: Atom, label: 'Atom' },
  MAGNET: { icon: Magnet, label: 'Magnet' },
  FLASK: { icon: FlaskConical, label: 'Flask' },
  DNA: { icon: Dna, label: 'DNA' },
  MICROSCOPE: { icon: Microscope, label: 'Microscope' },
  LEAF: { icon: Leaf, label: 'Leaf' },
  HEART: { icon: HeartPulse, label: 'Health' },
  BRAIN: { icon: Brain, label: 'Brain' },
  TELESCOPE: { icon: Telescope, label: 'Telescope' },
  LANDMARK: { icon: Landmark, label: 'Landmark' },
  SCROLL: { icon: Scroll, label: 'Scroll' },
  GLOBE: { icon: Globe2, label: 'Globe' },
  MOUNTAIN: { icon: Mountain, label: 'Mountain' },
  COMPASS: { icon: Compass, label: 'Compass' },
  LANGUAGES: { icon: Languages, label: 'Languages' },
  FEATHER: { icon: Feather, label: 'Quill' },
  PENCIL: { icon: Pencil, label: 'Pencil' },
  MESSAGE: { icon: MessageCircle, label: 'Speech' },
  LAPTOP: { icon: Laptop, label: 'Laptop' },
  CODE: { icon: Code, label: 'Code' },
  CPU: { icon: Cpu, label: 'Chip' },
  WRENCH: { icon: Wrench, label: 'Wrench' },
  LIGHTBULB: { icon: Lightbulb, label: 'Light bulb' },
  PALETTE: { icon: Palette, label: 'Palette' },
  MUSIC: { icon: Music, label: 'Music' },
  DRAMA: { icon: Drama, label: 'Theatre' },
  CAMERA: { icon: Camera, label: 'Camera' },
  DUMBBELL: { icon: Dumbbell, label: 'Sport' },
  SCALE: { icon: Scale, label: 'Scales' },
  TRENDING: { icon: TrendingUp, label: 'Chart' },
  USERS: { icon: Users, label: 'People' },
  CHURCH: { icon: Church, label: 'Church' },
  GRADUATION: { icon: GraduationCap, label: 'Graduation cap' },
}

export const SUBJECT_ICON_KEYS = Object.keys(SUBJECT_ICONS) as SubjectIconName[]

/**
 * Name patterns and the icon that fits them; the first match wins. The API
 * guesses the same way when a subject is created without an icon.
 */
const GUESSES: [RegExp, SubjectIconName][] = [
  [/sport|physical education|\bpe\b|gym/i, 'DUMBBELL'],
  [/math|algebra|geometr|calcul/i, 'CALCULATOR'],
  [/program|coding|software/i, 'CODE'],
  [/comput|informati|\bict\b|\bit\b/i, 'LAPTOP'],
  [/astronom/i, 'TELESCOPE'],
  [/physic/i, 'ATOM'],
  [/chemi/i, 'FLASK'],
  [/biolog|anatom/i, 'DNA'],
  [/science|nature|ecolog/i, 'LEAF'],
  [/health|medic/i, 'HEART'],
  [/psycholog|philosoph|logic/i, 'BRAIN'],
  [/histor/i, 'LANDMARK'],
  [/geograph/i, 'GLOBE'],
  [/econom|business|financ/i, 'TRENDING'],
  [/civic|law|politic/i, 'SCALE'],
  [/sociolog|social/i, 'USERS'],
  [/religio|theolog/i, 'CHURCH'],
  [/literat|writing|poetry/i, 'FEATHER'],
  [
    /english|romanian|french|german|spanish|italian|latin|language/i,
    'LANGUAGES',
  ],
  [/electronic|robot/i, 'CPU'],
  [/technolog|engineer/i, 'WRENCH'],
  [/music|choir/i, 'MUSIC'],
  [/drama|theat/i, 'DRAMA'],
  [/photo|media|film/i, 'CAMERA'],
  [/\bart\b|arts|drawing|design|paint/i, 'PALETTE'],
  [/counsel|tutor|homeroom|class master/i, 'GRADUATION'],
]

/** An icon that fits the subject's name, or a book when nothing fits. */
export function iconForName(name: string): SubjectIconName {
  return GUESSES.find(([pattern]) => pattern.test(name))?.[1] ?? 'BOOK'
}

/** Columns of the icon picker grid. */
export const ICON_COLUMNS = 8

/** Where the arrow keys move from `index` in a grid of ICON_COLUMNS columns. */
export function nextIconIndex(index: number, key: string, count: number) {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count
    case 'ArrowLeft':
      return (index - 1 + count) % count
    case 'ArrowDown':
      return index + ICON_COLUMNS < count
        ? index + ICON_COLUMNS
        : index % ICON_COLUMNS
    case 'ArrowUp': {
      if (index - ICON_COLUMNS >= 0) return index - ICON_COLUMNS
      const lastRowStart = Math.floor((count - 1) / ICON_COLUMNS) * ICON_COLUMNS
      const target = lastRowStart + (index % ICON_COLUMNS)
      return target < count ? target : target - ICON_COLUMNS
    }
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
