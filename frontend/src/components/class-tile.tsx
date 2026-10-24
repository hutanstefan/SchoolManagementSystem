import { cn } from '@/lib/utils'

/** The class name on the brand gradient, used next to a class's title. */
export function ClassTile({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-brand flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold text-white shadow-lg shadow-indigo-500/25',
        className,
      )}
    >
      {name}
    </span>
  )
}
