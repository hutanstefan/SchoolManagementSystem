import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { paginated, pageArgs } from '../common/dto/pagination.dto';
import { AuditKind, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditStore, CapturedChange } from './audit-context';
import { describe, refsOf, type RefKind } from './audit-changes';
import {
  AuditChangeDto,
  AuditDetailsDto,
  AuditLogDetailDto,
  AuditLogDto,
  AuditLogQueryDto,
  PaginatedAuditLogsDto,
} from './dto/audit.dto';

/** One entry to write. */
export interface AuditEntry {
  kind: AuditKind;
  actorId?: string | null;
  category: string;
  action: string;
  method?: string;
  path?: string;
  /** The `:id` of the route, if any: what the action is about. */
  routeId?: string;
  ip?: string | null;
  userAgent?: string | null;
  store?: AuditStore;
  email?: string;
  status?: number;
  /** What it was about, when there are no changes to name it from. */
  target?: string;
}

/** The record a route's `:id` points to, by category. */
const ROUTE_ID_KIND: Record<string, RefKind> = {
  Students: 'student',
  Teachers: 'teacher',
  Classes: 'class',
  Subjects: 'subject',
  Lectures: 'lecture',
};

const listSelect = {
  id: true,
  createdAt: true,
  kind: true,
  actorId: true,
  actorName: true,
  actorRole: true,
  category: true,
  action: true,
  target: true,
  method: true,
  path: true,
  changeCount: true,
  ip: true,
} satisfies Prisma.AuditLogSelect;

type ListRow = Prisma.AuditLogGetPayload<{ select: typeof listSelect }>;

const toDto = (row: ListRow): AuditLogDto => ({
  id: row.id,
  createdAt: row.createdAt,
  kind: row.kind,
  actor: { id: row.actorId, name: row.actorName, role: row.actorRole },
  category: row.category,
  action: row.action,
  target: row.target,
  method: row.method,
  path: row.path,
  changeCount: row.changeCount,
  ip: row.ip,
});

const clip = (value: string | null | undefined, max: number) =>
  value ? value.slice(0, max) : null;

/** The activity log: writes an entry per action, and lets admins read it. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Writes one entry. Never throws: the action itself already succeeded. */
  async write(entry: AuditEntry): Promise<void> {
    try {
      const changes = entry.store?.changes ?? [];
      const more = entry.store?.more ?? 0;
      const names = await this.namesFor(changes, entry);
      const labelled: AuditChangeDto[] = changes.map((change) => ({
        model: change.model,
        op: change.op,
        id: change.id,
        label: describe(change.model, change.record, names),
        fields: change.fields,
      }));
      const actor = entry.actorId
        ? await this.prisma.user.findUnique({
            where: { id: entry.actorId },
            select: { firstName: true, lastName: true, role: true },
          })
        : null;
      const details: AuditDetailsDto = {
        changes: labelled,
        more,
        names,
        ...(entry.email !== undefined && { email: entry.email }),
        ...(entry.status !== undefined && { status: entry.status }),
      };

      await this.prisma.auditLog.create({
        data: {
          kind: entry.kind,
          actorId: actor ? entry.actorId : null,
          actorName: actor ? `${actor.firstName} ${actor.lastName}` : null,
          actorRole: actor?.role ?? null,
          category: entry.category,
          action: entry.action,
          target: clip(this.targetOf(entry, labelled, names, more), 300),
          method: entry.method ?? null,
          path: clip(entry.path, 300),
          changeCount: changes.length + more,
          details: details as unknown as Prisma.InputJsonValue,
          ip: clip(entry.ip, 64),
          userAgent: clip(entry.userAgent, 300),
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not write the activity log (${entry.action}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async list(
    query: AuditLogQueryDto,
  ): Promise<Omit<PaginatedAuditLogsDto, 'retentionDays'>> {
    const where = this.whereOf(query);
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: listSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(rows.map(toDto), total, query);
  }

  async findOne(id: string): Promise<AuditLogDetailDto> {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
      select: { ...listSelect, userAgent: true, details: true },
    });
    if (!row) throw new NotFoundException('Activity log entry not found');
    const details = (row.details ?? {}) as Partial<AuditDetailsDto>;
    return {
      ...toDto(row),
      userAgent: row.userAgent,
      details: {
        changes: details.changes ?? [],
        more: details.more ?? 0,
        names: details.names ?? {},
        ...(details.email !== undefined && { email: details.email }),
        ...(details.status !== undefined && { status: details.status }),
      },
    };
  }

  // ---------------------------------------------------------------- helpers

  private whereOf(query: AuditLogQueryDto): Prisma.AuditLogWhereInput {
    const day = (value: string, end: boolean) => {
      const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
      if (end) date.setUTCDate(date.getUTCDate() + 1);
      return date;
    };
    return {
      ...(query.kind && { kind: query.kind }),
      ...(query.category && { category: query.category }),
      ...(query.actorId && { actorId: query.actorId }),
      ...(query.role && { actorRole: query.role }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: day(query.from, false) }),
          ...(query.to && { lt: day(query.to, true) }),
        },
      }),
      ...(query.search && {
        OR: [
          { actorName: { contains: query.search, mode: 'insensitive' } },
          { action: { contains: query.search, mode: 'insensitive' } },
          { target: { contains: query.search, mode: 'insensitive' } },
          { path: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
  }

  /** What the entry is about, in a few words. */
  private targetOf(
    entry: AuditEntry,
    changes: AuditChangeDto[],
    names: Record<string, string>,
    more: number,
  ): string | null {
    if (entry.target !== undefined) return entry.target;
    if (entry.email !== undefined) return entry.email;
    if (entry.routeId) {
      const own = changes.find((c) => c.id === entry.routeId && c.label);
      if (own) return own.label;
      if (names[entry.routeId]) return names[entry.routeId];
    }
    const labels = changes.map((c) => c.label).filter((l): l is string => !!l);
    if (labels.length === 0) return null;
    const others = changes.length - 1 + more;
    return others > 0 ? `${labels[0]} and ${others} more` : labels[0];
  }

  /** The names of every record the changes (and the route) refer to. */
  private async namesFor(
    changes: CapturedChange[],
    entry: AuditEntry,
  ): Promise<Record<string, string>> {
    const ids: Record<RefKind, Set<string>> = {
      student: new Set(),
      teacher: new Set(),
      subject: new Set(),
      class: new Set(),
      user: new Set(),
      lecture: new Set(),
      schoolYear: new Set(),
    };
    for (const change of changes) {
      for (const ref of refsOf(change.record)) ids[ref.kind].add(ref.id);
    }
    const routeKind = ROUTE_ID_KIND[entry.category];
    if (entry.routeId && routeKind) ids[routeKind].add(entry.routeId);

    const names: Record<string, string> = {};
    const person = (row: {
      id: string;
      user: { firstName: string; lastName: string };
    }) => (names[row.id] = `${row.user.firstName} ${row.user.lastName}`);
    const userName = { user: { select: { firstName: true, lastName: true } } };
    const list = (set: Set<string>) => ({ id: { in: [...set] } });

    await Promise.all([
      ids.student.size &&
        this.prisma.student
          .findMany({
            where: list(ids.student),
            select: { id: true, ...userName },
          })
          .then((rows) => rows.forEach(person)),
      ids.teacher.size &&
        this.prisma.teacher
          .findMany({
            where: list(ids.teacher),
            select: { id: true, ...userName },
          })
          .then((rows) => rows.forEach(person)),
      ids.user.size &&
        this.prisma.user
          .findMany({
            where: list(ids.user),
            select: { id: true, firstName: true, lastName: true },
          })
          .then((rows) =>
            rows.forEach((r) => (names[r.id] = `${r.firstName} ${r.lastName}`)),
          ),
      ids.subject.size &&
        this.prisma.subject
          .findMany({
            where: list(ids.subject),
            select: { id: true, name: true },
          })
          .then((rows) => rows.forEach((r) => (names[r.id] = r.name))),
      ids.class.size &&
        this.prisma.class
          .findMany({
            where: list(ids.class),
            select: {
              id: true,
              name: true,
              schoolYear: { select: { startYear: true } },
            },
          })
          .then((rows) =>
            rows.forEach(
              (r) =>
                (names[r.id] =
                  `${r.name} (${r.schoolYear.startYear}–${r.schoolYear.startYear + 1})`),
            ),
          ),
      ids.lecture.size &&
        this.prisma.lecture
          .findMany({
            where: list(ids.lecture),
            select: { id: true, title: true },
          })
          .then((rows) => rows.forEach((r) => (names[r.id] = r.title))),
      ids.schoolYear.size &&
        this.prisma.schoolYear
          .findMany({
            where: list(ids.schoolYear),
            select: { id: true, startYear: true },
          })
          .then((rows) =>
            rows.forEach(
              (r) => (names[r.id] = `${r.startYear}–${r.startYear + 1}`),
            ),
          ),
    ]);
    return names;
  }
}
