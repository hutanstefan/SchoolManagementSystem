import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditRetentionService } from './audit-retention.service';
import { AuditService } from './audit.service';

/** The activity log: what everyone did, for admins. */
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditRetentionService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AuditModule {}
