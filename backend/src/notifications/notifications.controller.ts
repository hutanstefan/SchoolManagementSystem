import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import {
  MarkAllReadResultDto,
  NotificationQueryDto,
  PaginatedNotificationsDto,
  UnreadCountDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

/** Every logged-in user has their own notifications. */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'My notifications, newest first',
    description:
      'New ones are also pushed live over Socket.IO (path /api/socket.io, event "notification").',
  })
  @ApiOkResponse({ type: PaginatedNotificationsDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationQueryDto,
  ): Promise<PaginatedNotificationsDto> {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'How many of my notifications are unread' })
  @ApiOkResponse({ type: UnreadCountDto })
  async unreadCount(@CurrentUser() user: AuthUser): Promise<UnreadCountDto> {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiOkResponse({ type: MarkAllReadResultDto })
  markAllRead(@CurrentUser() user: AuthUser): Promise<MarkAllReadResultDto> {
    return this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one of my notifications as read' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notifications.markRead(user.id, id);
  }
}
