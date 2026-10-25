import {
  KeyRound,
  LogIn,
  LogOut,
  Minus,
  Pencil,
  Plus,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { DataTable, type Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { PersonAvatar } from '@/components/person-avatar'
import { SearchInput } from '@/components/search-input'
import { ErrorState, LoadingBlock } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDateTime, formatTimeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  useAuditLog,
  useAuditLogs,
  type AuditCategory,
  type AuditChange,
  type AuditKind,
  type AuditLog,
  type AuditQuery,
} from './api'
import {
  AUDIT_CATEGORIES,
  browserOf,
  fieldLabel,
  formatValue,
  KIND_LABELS,
  modelLabel,
  OP_LABELS,
} from './audit-format'

const ALL = 'all'
type Role = NonNullable<AuditQuery['role']>
const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admins',
  TEACHER: 'Teachers',
  STUDENT: 'Students',
}
const ROLE_NAMES: Record<Role, string> = {
  ADMIN: 'Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
}

/** "Entries are kept for 2 years." */
function keptFor(days: number | null | undefined): string {
  if (days === undefined) return ''
  if (days === null) return 'Entries are kept forever.'
  const period =
    days % 365 === 0
      ? `${days / 365} ${days === 365 ? 'year' : 'years'}`
      : `${days} ${days === 1 ? 'day' : 'days'}`
  return `Entries are kept for ${period}, then deleted.`
}

const KIND_ICONS: Record<AuditKind, typeof LogIn> = {
  CHANGE: Pencil,
  LOGIN: LogIn,
  LOGOUT: LogOut,
  LOGIN_FAILED: ShieldAlert,
}

function Who({ entry }: { entry: AuditLog }) {
  const { actor } = entry
  if (!actor.name) {
    return (
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full"
        >
          <KeyRound className="size-3.5" />
        </span>
        <span className="text-muted-foreground text-sm">
          {entry.kind === 'LOGIN_FAILED' ? 'Unknown' : 'Deleted user'}
        </span>
      </div>
    )
  }
  const [firstName = '', ...rest] = actor.name.split(' ')
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonAvatar person={{ firstName, lastName: rest.join(' ') }} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{actor.name}</div>
        {actor.role && (
          <div className="text-muted-foreground text-xs">
            {ROLE_NAMES[actor.role]}
          </div>
        )}
      </div>
    </div>
  )
}

function What({ entry }: { entry: AuditLog }) {
  const Icon = KIND_ICONS[entry.kind]
  const failed = entry.kind === 'LOGIN_FAILED'
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md [&>svg]:size-3.5',
          failed
            ? 'bg-destructive/10 text-destructive'
            : 'bg-primary/10 text-primary',
        )}
      >
        <Icon />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium">{entry.action}</div>
        {entry.target && (
          <div className="text-muted-foreground truncate text-xs">
            {entry.target}
          </div>
        )}
        <div className="text-muted-foreground text-xs sm:hidden">
          {formatTimeAgo(entry.createdAt)}
        </div>
      </div>
    </div>
  )
}

/**
 * The activity log (admins): every action that changed something, every
 * login, logout and failed login, with who did it and what changed.
 */
export function ActivityPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>(ALL)
  const [kind, setKind] = useState<string>(ALL)
  const [role, setRole] = useState<string>(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search.trim())
  const query: AuditQuery = {
    page,
    pageSize: 25,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(category !== ALL && { category: category as AuditCategory }),
    ...(kind !== ALL && { kind: kind as AuditKind }),
    ...(role !== ALL && { role: role as Role }),
    ...(from && { from }),
    ...(to && { to }),
  }
  const logs = useAuditLogs(query)
  const filtered =
    debouncedSearch ||
    category !== ALL ||
    kind !== ALL ||
    role !== ALL ||
    from ||
    to
  const reset = () => {
    setSearch('')
    setCategory(ALL)
    setKind(ALL)
    setRole(ALL)
    setFrom('')
    setTo('')
    setPage(1)
  }
  /** A filter changed: back to the first page. */
  const filter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value)
      setPage(1)
    }

  const columns: Column<AuditLog>[] = [
    {
      header: 'When',
      className: 'hidden sm:table-cell w-40',
      cell: (e) => (
        <div className="whitespace-nowrap">
          <div className="text-sm">{formatTimeAgo(e.createdAt)}</div>
          <div className="text-muted-foreground text-xs">
            {formatDateTime(e.createdAt)}
          </div>
        </div>
      ),
    },
    {
      header: 'Who',
      className: 'w-40 sm:w-56',
      cell: (e) => <Who entry={e} />,
    },
    { header: 'What', cell: (e) => <What entry={e} /> },
    {
      header: 'Area',
      className: 'hidden lg:table-cell w-44',
      cell: (e) => <Badge variant="secondary">{e.category}</Badge>,
    },
    {
      header: <span className="sr-only">Changes</span>,
      className: 'hidden sm:table-cell w-28 text-right',
      cell: (e) =>
        e.changeCount > 0 && (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {e.changeCount} {e.changeCount === 1 ? 'change' : 'changes'}
          </span>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Activity log"
        description={`Everything that changed in the app, who did it and when, plus every login. Passwords and private chat messages are never logged. ${keptFor(logs.data?.retentionDays)}`}
      />

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <SearchInput
              value={search}
              onChange={filter(setSearch)}
              placeholder="Search people, actions, records"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex">
              <Select value={category} onValueChange={filter(setCategory)}>
                <SelectTrigger className="w-full lg:w-48" aria-label="Area">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All areas</SelectItem>
                  {AUDIT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={kind} onValueChange={filter(setKind)}>
                <SelectTrigger className="w-full lg:w-40" aria-label="Kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Everything</SelectItem>
                  {(Object.keys(KIND_LABELS) as AuditKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={role} onValueChange={filter(setRole)}>
                <SelectTrigger className="w-full lg:w-36" aria-label="Who">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Everyone</SelectItem>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-from" className="text-xs">
                From
              </Label>
              <Input
                id="audit-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => filter(setFrom)(event.target.value)}
                className="sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-to" className="text-xs">
                To
              </Label>
              <Input
                id="audit-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => filter(setTo)(event.target.value)}
                className="sm:w-40"
              />
            </div>
            {filtered && (
              <Button
                variant="ghost"
                size="sm"
                className="col-span-2 justify-self-start"
                onClick={reset}
              >
                <X aria-hidden /> Clear filters
              </Button>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={logs.data?.data}
          rowKey={(e) => e.id}
          isLoading={logs.isPending}
          error={logs.error}
          onRetry={() => void logs.refetch()}
          emptyTitle={filtered ? 'Nothing matches' : 'Nothing logged yet'}
          emptyDescription={
            filtered
              ? 'Try other filters.'
              : 'Actions show up here as soon as someone logs in or changes something.'
          }
          onRowClick={(e) => setOpenId(e.id)}
        />
        <PaginationBar meta={logs.data?.meta} onPageChange={setPage} />
      </Card>

      <EntrySheet id={openId} onClose={() => setOpenId(null)} />
    </>
  )
}

const OP_STYLES: Record<
  AuditChange['op'],
  { badge: string; icon: typeof Plus }
> = {
  create: {
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    icon: Plus,
  },
  update: {
    badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    icon: Pencil,
  },
  delete: { badge: 'bg-destructive/10 text-destructive', icon: Minus },
}

/** One entry: who, when, from where, and every record it changed. */
function EntrySheet({
  id,
  onClose,
}: {
  id: string | null
  onClose: () => void
}) {
  const entry = useAuditLog(id)
  const data = entry.data
  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{data?.action ?? 'Activity'}</SheetTitle>
          <SheetDescription>
            {data
              ? `${data.category} · ${formatDateTime(data.createdAt)}`
              : ' '}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {entry.isPending ? (
            <LoadingBlock rows={5} />
          ) : entry.error || !data ? (
            <ErrorState
              error={entry.error}
              onRetry={() => void entry.refetch()}
            />
          ) : (
            <div className="flex flex-col gap-5">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Who</dt>
                <dd>
                  {data.actor.name
                    ? `${data.actor.name}${data.actor.role ? ` (${ROLE_NAMES[data.actor.role]})` : ''}`
                    : data.kind === 'LOGIN_FAILED'
                      ? 'Unknown'
                      : 'Deleted user'}
                </dd>
                {data.details.email && (
                  <>
                    <dt className="text-muted-foreground">Email tried</dt>
                    <dd className="break-all">{data.details.email}</dd>
                  </>
                )}
                {data.target && (
                  <>
                    <dt className="text-muted-foreground">About</dt>
                    <dd>{data.target}</dd>
                  </>
                )}
                {data.path && (
                  <>
                    <dt className="text-muted-foreground">Request</dt>
                    <dd className="font-mono text-xs break-all">
                      {data.method} {data.path}
                    </dd>
                  </>
                )}
                {data.ip && (
                  <>
                    <dt className="text-muted-foreground">IP address</dt>
                    <dd className="tabular-nums">{data.ip}</dd>
                  </>
                )}
                {browserOf(data.userAgent) && (
                  <>
                    <dt className="text-muted-foreground">Browser</dt>
                    <dd>{browserOf(data.userAgent)}</dd>
                  </>
                )}
              </dl>

              {data.details.changes.length > 0 && (
                <section aria-labelledby="audit-changes">
                  <h3 id="audit-changes" className="mb-2 text-sm font-semibold">
                    What changed
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {data.details.changes.map((change, index) => (
                      <ChangeCard
                        key={`${change.id ?? ''}-${index}`}
                        change={change}
                        names={data.details.names}
                      />
                    ))}
                  </ul>
                  {data.details.more > 0 && (
                    <p className="text-muted-foreground mt-3 text-xs">
                      And {data.details.more} more{' '}
                      {data.details.more === 1 ? 'change' : 'changes'}, not
                      shown.
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ChangeCard({
  change,
  names,
}: {
  change: AuditChange
  names: Record<string, string>
}) {
  const style = OP_STYLES[change.op]
  const Icon = style.icon
  // The database keeps no key order: alphabetical reads best.
  const fields = (
    Object.entries(change.fields) as [string, [unknown, unknown]][]
  ).sort(([a], [b]) => fieldLabel(a).localeCompare(fieldLabel(b)))
  return (
    <li className="rounded-lg border">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium [&>svg]:size-3',
            style.badge,
          )}
        >
          <Icon aria-hidden />
          {OP_LABELS[change.op]}
        </span>
        <span className="text-sm font-medium">{modelLabel(change.model)}</span>
        {change.label && (
          <span className="text-muted-foreground min-w-0 truncate text-sm">
            · {change.label}
          </span>
        )}
      </div>
      {fields.length > 0 && (
        <table className="w-full text-xs">
          <thead className="sr-only">
            <tr>
              <th>Field</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(([field, [before, after]]) => (
              <tr key={field} className="border-b last:border-b-0">
                <th
                  scope="row"
                  className="text-muted-foreground w-1/3 px-3 py-1.5 text-left align-top font-normal"
                >
                  {fieldLabel(field)}
                </th>
                {change.op === 'update' ? (
                  <td className="px-3 py-1.5 align-top">
                    <span className="text-muted-foreground line-through">
                      {formatValue(before, names)}
                    </span>{' '}
                    <span aria-hidden>→</span>{' '}
                    <span className="font-medium">
                      {formatValue(after, names)}
                    </span>
                  </td>
                ) : (
                  <td className="px-3 py-1.5 align-top break-words">
                    {formatValue(
                      change.op === 'create' ? after : before,
                      names,
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  )
}
