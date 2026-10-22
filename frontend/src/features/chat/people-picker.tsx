import { useState } from 'react'
import { SearchInput } from '@/components/search-input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'
import { useContacts, type ChatContact } from './api'
import { ChatAvatar } from './chat-avatar'

interface Group {
  key: string
  label: string
  people: ChatContact[]
}

/** Teachers, then students class by class (contacts come sorted). */
function groupContacts(contacts: ChatContact[]): Group[] {
  const groups = new Map<string, Group>()
  for (const contact of contacts) {
    const key =
      contact.role === 'STUDENT'
        ? `class:${contact.class?.name ?? '-'}`
        : contact.role
    const label =
      contact.role === 'STUDENT'
        ? contact.class
          ? `Class ${contact.class.name}`
          : 'Students without a class'
        : 'Teachers'
    const group = groups.get(key) ?? { key, label, people: [] }
    group.people.push(contact)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/**
 * Search and pick people the user may write to. One person (a new direct
 * message) or many (a group), with "select all" per class.
 */
export function PeoplePicker({
  mode,
  selected = [],
  onSelectedChange,
  onPick,
  exclude = [],
}: {
  mode: 'one' | 'many'
  selected?: string[]
  onSelectedChange?: (ids: string[]) => void
  onPick?: (contact: ChatContact) => void
  exclude?: string[]
}) {
  const [search, setSearch] = useState('')
  const contacts = useContacts(useDebouncedValue(search.trim()))
  const hidden = new Set(exclude)
  const groups = groupContacts(
    (contacts.data ?? []).filter((c) => !hidden.has(c.id)),
  )
  const isSelected = new Set(selected)

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    onSelectedChange?.([...next])
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search people"
        className="sm:max-w-none"
      />
      <div className="-mx-1 max-h-[min(22rem,50vh)] min-h-40 overflow-y-auto px-1">
        {contacts.isPending ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            Nobody found.
          </p>
        ) : (
          groups.map((group) => {
            const ids = group.people.map((p) => p.id)
            const all = ids.every((id) => isSelected.has(id))
            return (
              <section key={group.key} className="mb-2">
                <div className="bg-background sticky top-0 z-10 flex items-center justify-between py-1.5">
                  <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {group.label}
                  </h3>
                  {mode === 'many' && ids.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggle(ids, !all)}
                    >
                      {all ? 'Unselect all' : `Select all ${ids.length}`}
                    </Button>
                  )}
                </div>
                <ul>
                  {group.people.map((person) => (
                    <li key={person.id}>
                      <PersonRow
                        person={person}
                        mode={mode}
                        checked={isSelected.has(person.id)}
                        onClick={() =>
                          mode === 'one'
                            ? onPick?.(person)
                            : toggle([person.id], !isSelected.has(person.id))
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}

function PersonRow({
  person,
  mode,
  checked,
  onClick,
}: {
  person: ChatContact
  mode: 'one' | 'many'
  checked: boolean
  onClick: () => void
}) {
  const content = (
    <>
      <ChatAvatar person={person} className="size-8" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {person.firstName} {person.lastName}
        </span>
        {person.detail && (
          <span className="text-muted-foreground block truncate text-xs">
            {person.detail}
          </span>
        )}
      </span>
    </>
  )
  const rowClass = cn(
    'hover:bg-accent flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left',
    checked && 'bg-accent/60',
  )
  // Picking several: a checkbox with its label (no button inside a button).
  if (mode === 'many') {
    return (
      <label className={rowClass}>
        <Checkbox checked={checked} onCheckedChange={onClick} />
        {content}
      </label>
    )
  }
  return (
    <button type="button" onClick={onClick} className={rowClass}>
      {content}
    </button>
  )
}
