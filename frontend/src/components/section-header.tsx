import type { ReactNode } from 'react'

/** Title bar at the top of a card that holds a table or a list. */
export function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b px-4 py-2">
      <h2 className="font-semibold">{title}</h2>
      {action}
    </div>
  )
}
