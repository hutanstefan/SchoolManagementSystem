import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ToBoolean } from '../../common/transformers';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { NotificationType } from '../../generated/prisma/enums';

export class NotificationQueryDto extends PickType(PaginationQueryDto, [
  'page',
  'pageSize',
]) {
  /** Only unread notifications. */
  @IsOptional()
  @ToBoolean()
  @IsIn([true, false])
  unread?: boolean;
}

export class NotificationDto {
  id!: string;
  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type!: NotificationType;
  /** @example New grade in Mathematics: 9 */
  title!: string;
  /** @example Given on 22 Oct 2026. */
  body!: string;
  /** The page of the app it is about. @example /student/grades */
  link!: string | null;
  /** Null while unread. */
  readAt!: Date | null;
  createdAt!: Date;
}

export class PaginatedNotificationsDto {
  data!: NotificationDto[];
  meta!: PaginationMetaDto;
}

export class UnreadCountDto {
  /** @example 3 */
  count!: number;
}

export class MarkAllReadResultDto {
  /** How many notifications were marked as read. @example 3 */
  count!: number;
}
