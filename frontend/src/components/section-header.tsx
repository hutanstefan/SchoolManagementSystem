import type { ReactNode } from 'react'

/** Title bar at the top of a card that holds a table or a list. */
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-5 py-3">
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
