import { AsyncLocalStorage } from 'node:async_hooks';

/** One record created, changed or deleted while handling a request. */
export interface CapturedChange {
  /** The Prisma model, e.g. "Grade". */
  model: string;
  op: 'create' | 'update' | 'delete';
  id: string | null;
  /** Field -> [before, after]; null on the missing side. */
  fields: Record<string, [unknown, unknown]>;
  /** The record as it is after the change (or before a delete), to name it. */
  record: Record<string, unknown>;
}

/** What the activity log collects during one request. */
export interface AuditStore {
  changes: CapturedChange[];
  /** Changes past the cap: counted, not kept. */
  more: number;
  /** Set once the log entry is written: later writes are not part of it. */
  closed: boolean;
}

/** Most changes kept in one log entry; the rest are only counted. */
export const MAX_CHANGES = 100;

/**
 * The request being handled, as far as the activity log is concerned. The
 * AuditInterceptor opens it around each request that changes something;
 * the Prisma extension adds the changes to it.
 */
export const auditStorage = new AsyncLocalStorage<AuditStore>();

export function newAuditStore(): AuditStore {
  return { changes: [], more: 0, closed: false };
}

export function addChange(store: AuditStore, change: CapturedChange): void {
  if (store.closed) return;
  if (store.changes.length < MAX_CHANGES) store.changes.push(change);
  else store.more += 1;
}
