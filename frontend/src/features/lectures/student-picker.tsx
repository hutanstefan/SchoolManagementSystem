import { ChevronRight, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PersonAvatar } from '@/components/person-avatar'
import { SearchInput } from '@/components/search-input'
import { LoadingBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { LectureStudent } from './api'
import { groupByClass, groupState, matchesSearch, toggleMany } from './picker'

/**
 * Choose any students of the school: grouped by class, a whole class with
 * one tick, or one by one (search by name, reg. no. or class).
 */
export function StudentPicker({
  students,
  isLoading,
  selected,
  onChange,
  className,
}: {
  students: LectureStudent[] | undefined
  isLoading?: boolean
  selected: ReadonlySet<string>
  onChange: (selected: Set<string>) => void
  className?: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())

  const groups = useMemo(() => {
    const term = search.trim()
    const shown = term
      ? (students ?? []).filter((s) => matchesSearch(s, term))
      : (students ?? [])
    return groupByClass(shown)
  }, [students, search])

  const searching = search.trim() !== ''
  const toggleOpen = (key: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className={cn('flex min-h-0 flex-col rounded-lg border', className)}>
      <div className="flex flex-col gap-2 border-b p-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search students or classes"
          className="sm:max-w-none"
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            <span aria-live="polite">
              {selected.size === 0
                ? 'Nobody yet'
                : `${selected.size} ${selected.size === 1 ? 'student' : 'students'} selected`}
            </span>
          </span>
          {selected.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onChange(new Set())}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingBlock rows={4} />
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            No student matches “{search}”.
          </p>
        ) : (
          <ul aria-label="Students by class">
            {groups.map((group) => {
              const state = groupState(group.students, selected)
              const count = group.students.filter((s) =>
                selected.has(s.id),
              ).length
              const expanded = searching || open.has(group.key)
              const ids = group.students.map((s) => s.id)
              return (
                <li key={group.key} className="border-b last:border-b-0">
                  <div className="hover:bg-muted/50 flex items-center gap-2 px-3 py-2">
                    <Checkbox
                      checked={state}
                      onCheckedChange={() =>
                        onChange(toggleMany(selected, ids, state !== true))
                      }
                      aria-label={`All of ${group.name}`}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                      aria-expanded={expanded}
                      onClick={() => toggleOpen(group.key)}
                      disabled={searching}
                    >
                      <span className="font-medium">{group.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {count > 0
                          ? `${count} of ${group.students.length}`
                          : `${group.students.length} students`}
                      </span>
                      <ChevronRight
                        className={cn(
                          'text-muted-foreground ml-auto size-4 transition-transform',
                          expanded && 'rotate-90',
                        )}
                        aria-hidden
                      />
                    </button>
                  </div>
                  {expanded && (
                    <ul className="pb-1">
                      {group.students.map((student) => {
                        const id = `pick-${student.id}`
                        return (
                          <li key={student.id}>
                            <label
                              htmlFor={id}
                              className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 py-1.5 pr-3 pl-9"
                            >
                              <Checkbox
                                id={id}
                                checked={selected.has(student.id)}
                                onCheckedChange={(checked) =>
                                  onChange(
                                    toggleMany(
                                      selected,
                                      [student.id],
                                      checked === true,
                                    ),
                                  )
                                }
                              />
                              <PersonAvatar
                                person={student}
                                className="size-7 text-[10px]"
                              />
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {student.firstName} {student.lastName}
                              </span>
                              <span className="text-muted-foreground text-xs tabular-nums">
                                {student.registrationNumber}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
