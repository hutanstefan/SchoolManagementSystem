import { createElement, useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { SUBJECT_COLORS, type SubjectColor } from './subject-colors'
import {
  nextIconIndex,
  SUBJECT_ICON_KEYS,
  SUBJECT_ICONS,
  type SubjectIconName,
} from './subject-icons'

/**
 * A grid of the subject icons, tinted with the subject's colour. One tab
 * stop: the arrow keys move between icons (a radio group).
 */
export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: SubjectIconName
  color: SubjectColor
  onChange: (icon: SubjectIconName) => void
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const next = nextIconIndex(index, event.key, SUBJECT_ICON_KEYS.length)
    const icon = next === null ? undefined : SUBJECT_ICON_KEYS[next]
    if (next === null || icon === undefined) return
    event.preventDefault()
    onChange(icon)
    buttons.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Icon"
      className="grid grid-cols-8 gap-x-1 gap-y-1.5"
    >
      {SUBJECT_ICON_KEYS.map((key, index) => {
        const checked = key === value
        const { icon, label } = SUBJECT_ICONS[key]
        return (
          <button
            key={key}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={label}
            title={label}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'focus-visible:ring-ring ring-offset-background flex aspect-square w-full max-w-10 items-center justify-center justify-self-center rounded-md transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2 [&>svg]:size-4',
              checked
                ? cn(SUBJECT_COLORS[color].tile, 'ring-2 ring-current')
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {createElement(icon, { 'aria-hidden': true })}
          </button>
        )
      })}
    </div>
  )
}
