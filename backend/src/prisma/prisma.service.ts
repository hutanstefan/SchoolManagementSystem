import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { auditExtension } from '../audit/prisma-audit.extension';
import { Env } from '../config/env.validation';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma client exposed as an injectable Nest provider.
 * Connects on startup and disconnects cleanly on shutdown. Writes made while
 * a request is handled are recorded for the activity log (auditExtension).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    });
    // The extended client keeps this class's methods (it wraps this
    // instance), so it can stand in for it everywhere PrismaService is used.
    return this.$extends(auditExtension(this)) as unknown as this;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
