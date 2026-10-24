import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from its previous value to `target` (ease-out, ~0.8 s),
 * for dashboard figures. Keeps the decimals of the target; no animation when
 * the user prefers reduced motion.
 */
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const start = from.current
    if (reduce || start === target) {
      from.current = target
      const frame = requestAnimationFrame(() => setValue(target))
      return () => cancelAnimationFrame(frame)
    }
    let frame = 0
    const began = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - began) / duration)
      const eased = 1 - (1 - progress) ** 3
      setValue(start + (target - start) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else from.current = target
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}
