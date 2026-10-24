import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
  leading,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Shown before the title, e.g. an avatar on a person's page. */
  leading?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-8">
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-1.5 text-sm">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
