import { Injectable, NotFoundException } from '@nestjs/common';
import type { Paginated } from '../common/dto/pagination.dto';
import type { NotificationType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MarkAllReadResultDto,
  NotificationDto,
  NotificationQueryDto,
} from './dto/notification.dto';
import { NotificationsGateway, ServerEvents } from './notifications.gateway';

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  body: true,
  link: true,
  readAt: true,
  createdAt: true,
} as const;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /** Saves the notifications and pushes each one to its user's open tabs. */
  async notify(notifications: NewNotification[]): Promise<void> {
    if (notifications.length === 0) return;
    const created = await this.prisma.notification.createManyAndReturn({
      data: notifications.map((n) => ({ ...n, link: n.link ?? null })),
      select: notificationSelect,
    });
    for (const { userId, ...notification } of created) {
      this.gateway.sendToUser(userId, ServerEvents.Notification, notification);
    }
  }

  /** The user's notifications, newest first. */
  async list(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<Paginated<NotificationDto>> {
    const where = {
      userId,
      ...(query.unread === true && { readAt: null }),
      ...(query.unread === false && { readAt: { not: null } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      data: rows.map(({ userId: _owner, ...notification }) => notification),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** Users can only see and read their own notifications (404 otherwise). */
  async markRead(userId: string, id: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      select: { userId: true, readAt: true },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.readAt) return;
    await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    this.gateway.sendToUser(userId, ServerEvents.NotificationsRead, {});
  }

  async markAllRead(userId: string): Promise<MarkAllReadResultDto> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count > 0) {
      this.gateway.sendToUser(userId, ServerEvents.NotificationsRead, {});
    }
    return { count };
  }
}
