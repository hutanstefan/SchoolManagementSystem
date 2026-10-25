import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { AuditKind } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

const DAY = 24 * 60 * 60 * 1000;
/** Rows deleted per statement: short locks, even with millions to go. */
const BATCH = 5000;
/** The first run waits a little, so starting the API stays fast. */
const FIRST_RUN_DELAY = 60 * 1000;

/**
 * Keeps the activity log from growing forever: once a day, entries older
 * than AUDIT_RETENTION_DAYS are deleted, in small batches, and the deletion
 * itself is logged. With several API instances, each one does it; that is
 * harmless (the second finds nothing to delete).
 */
@Injectable()
export class AuditRetentionService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AuditRetentionService.name);
  private readonly days: number;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.days = config.get('AUDIT_RETENTION_DAYS', { infer: true });
  }

  /** How long entries are kept, in days; null: forever. */
  get retentionDays(): number | null {
    return this.days > 0 ? this.days : null;
  }

  onApplicationBootstrap(): void {
    if (this.days === 0 || process.env.NODE_ENV === 'test') return;
    const run = () =>
      void this.purge().catch((error: unknown) =>
        this.logger.error(
          `Could not delete old activity log entries: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    const first = setTimeout(() => {
      run();
      const daily = setInterval(run, DAY);
      daily.unref();
      this.timers.push(daily);
    }, FIRST_RUN_DELAY);
    first.unref();
    this.timers.push(first);
  }

  onApplicationShutdown(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  /**
   * Deletes the entries older than the retention period (as of `now`) and
   * returns how many. Logs the deletion when there was something to delete.
   */
  async purge(now = new Date()): Promise<number> {
    if (this.days === 0) return 0;
    const cutoff = new Date(now.getTime() - this.days * DAY);
    let deleted = 0;
    for (;;) {
      const count = await this.prisma.$executeRaw`
        DELETE FROM audit_logs
        WHERE id IN (
          SELECT id FROM audit_logs WHERE created_at < ${cutoff} LIMIT ${BATCH}
        )`;
      deleted += count;
      if (count < BATCH) break;
    }
    if (deleted > 0) {
      this.logger.log(
        `Deleted ${deleted} activity log entries older than ${this.days} days`,
      );
      await this.audit.write({
        kind: AuditKind.CHANGE,
        category: 'System',
        action: 'Deleted old activity log entries',
        target: `${deleted} ${deleted === 1 ? 'entry' : 'entries'} older than ${this.days} days`,
      });
    }
    return deleted;
  }
}
