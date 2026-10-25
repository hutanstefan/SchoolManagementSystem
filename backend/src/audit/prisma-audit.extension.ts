import { Prisma, type PrismaClient } from '../generated/prisma/client';
import {
  addChange,
  auditStorage,
  MAX_CHANGES,
  type AuditStore,
} from './audit-context';
import {
  AUDITED_MODELS,
  changedFields,
  createdFields,
  deletedFields,
  flattenData,
  flattenRecord,
  nestedWrites,
} from './audit-changes';

type Row = Record<string, unknown>;

/** The delegate of a model on the plain client (prisma.grade for "Grade"). */
type Delegate = {
  findUnique(args: {
    where: unknown;
    include?: Record<string, boolean>;
  }): Promise<Row | null>;
  findMany(args: { where: unknown; take: number }): Promise<Row[]>;
};

const idOf = (row: Row | null | undefined): string | null =>
  row && typeof row.id === 'string' ? row.id : null;

function recordCreate(
  store: AuditStore,
  model: string,
  data: unknown,
  id: string | null,
) {
  const after = flattenData(data);
  addChange(store, {
    model,
    op: 'create',
    id: id ?? idOf(after),
    fields: createdFields(after),
    record: after,
  });
}

/** The record before an update, with the related records it writes through. */
async function readBefore(
  delegate: Delegate,
  where: unknown,
  data: unknown,
): Promise<Row | null> {
  const nested = nestedWrites(data);
  const row = await delegate.findUnique({
    where,
    ...(nested.length > 0 && {
      include: Object.fromEntries(nested.map((key) => [key, true])),
    }),
  });
  return row && flattenRecord(row);
}

function recordUpdate(
  store: AuditStore,
  model: string,
  before: Row,
  data: unknown,
) {
  const set = flattenData(data);
  const fields = changedFields(before, set);
  if (Object.keys(fields).length === 0) return;
  addChange(store, {
    model,
    op: 'update',
    id: idOf(before),
    fields,
    record: { ...before, ...set },
  });
}

function recordDelete(store: AuditStore, model: string, before: Row) {
  addChange(store, {
    model,
    op: 'delete',
    id: idOf(before),
    fields: deletedFields(before),
    record: before,
  });
}

/**
 * Writes to the database made while a request is handled are added to that
 * request's activity log entry (see AuditInterceptor): what was created,
 * what changed (before -> after) and what was deleted. Outside a request
 * (the seed, scripts) nothing happens.
 *
 * Records are read before they change through `base`, the client without
 * this extension. Inside a transaction that read sees the last committed
 * state, which is what was there before the request.
 */
export function auditExtension(base: PrismaClient) {
  return Prisma.defineExtension({
    name: 'audit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const store = auditStorage.getStore();
          if (!store || store.closed || !AUDITED_MODELS.has(model)) {
            return query(args);
          }
          const delegate = (base as unknown as Record<string, Delegate>)[
            model.charAt(0).toLowerCase() + model.slice(1)
          ];
          const a = args as {
            where?: unknown;
            data?: unknown;
            create?: unknown;
            update?: unknown;
          };

          switch (operation) {
            case 'create': {
              const result = (await query(args)) as Row;
              recordCreate(store, model, a.data, idOf(result));
              return result;
            }
            case 'createMany':
            case 'createManyAndReturn': {
              const result = await query(args);
              const rows = Array.isArray(a.data) ? a.data : [a.data];
              const created = Array.isArray(result) ? (result as Row[]) : [];
              rows.forEach((data, index) =>
                recordCreate(store, model, data, idOf(created[index])),
              );
              return result;
            }
            case 'update': {
              const before = await readBefore(delegate, a.where, a.data);
              const result = await query(args);
              if (before) recordUpdate(store, model, before, a.data);
              return result;
            }
            case 'updateMany':
            case 'updateManyAndReturn': {
              const before = await delegate.findMany({
                where: a.where,
                take: MAX_CHANGES + 1,
              });
              const result = await query(args);
              before.forEach((row) => recordUpdate(store, model, row, a.data));
              const count = (result as { count?: number }).count;
              if (typeof count === 'number' && count > before.length) {
                store.more += count - before.length;
              }
              return result;
            }
            case 'upsert': {
              const before = await readBefore(delegate, a.where, a.update);
              const result = (await query(args)) as Row;
              if (before) recordUpdate(store, model, before, a.update);
              else recordCreate(store, model, a.create, idOf(result));
              return result;
            }
            case 'delete': {
              const before = await delegate.findUnique({ where: a.where });
              const result = await query(args);
              if (before) recordDelete(store, model, before);
              return result;
            }
            case 'deleteMany': {
              const before = await delegate.findMany({
                where: a.where,
                take: MAX_CHANGES + 1,
              });
              const result = await query(args);
              before.forEach((row) => recordDelete(store, model, row));
              const count = (result as { count?: number }).count;
              if (typeof count === 'number' && count > before.length) {
                store.more += count - before.length;
              }
              return result;
            }
            default:
              return query(args);
          }
        },
      },
    },
  });
}
