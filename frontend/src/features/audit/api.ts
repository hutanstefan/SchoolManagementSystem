import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import type { operations } from '@/api/schema'

export type AuditLog = Schemas['AuditLogDto']
export type AuditLogDetail = Schemas['AuditLogDetailDto']
export type AuditChange = Schemas['AuditChangeDto']
export type AuditKind = Schemas['AuditKind']
export type AuditCategory = Schemas['AuditCategory']
export type AuditQuery = NonNullable<
  operations['AuditController_list']['parameters']['query']
>

/** The activity log, newest first, a page at a time (admins). */
export function useAuditLogs(query: AuditQuery) {
  return useQuery({
    queryKey: queryKeys.audit.list(query),
    queryFn: () => unwrap(api.GET('/api/audit-logs', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}

/** One entry with what changed. */
export function useAuditLog(id: string | null) {
  return useQuery({
    queryKey: queryKeys.audit.detail(id ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/audit-logs/{id}', { params: { path: { id: id! } } }),
      ),
    enabled: id !== null,
    // An entry never changes.
    staleTime: Infinity,
  })
}
