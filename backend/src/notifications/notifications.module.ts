import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationRulesListener } from './notification-rules.listener';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    NotificationRulesListener,
  ],
})
export class NotificationsModule {}
