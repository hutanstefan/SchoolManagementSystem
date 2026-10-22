import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ClassSummaryDto } from '../../common/dto/summaries.dto';
import { Trim } from '../../common/transformers';
import {
  ChatRole,
  ConversationType,
  MessageKind,
  Role,
} from '../../generated/prisma/enums';

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_GROUP_MEMBERS = 100;

// ------------------------------------------------------------------ inputs

export class ContactsQueryDto {
  /** Part of a first or last name. */
  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(100)
  search?: string;
}

export class OpenDirectConversationDto {
  /** The user (not student or teacher id) to talk to. */
  @IsUUID()
  userId!: string;
}

export class CreateGroupDto {
  /** @example 9A · Mathematics */
  @IsString()
  @Trim()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  /** Users to add, besides the creator (at least one). */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GROUP_MEMBERS)
  @IsUUID('all', { each: true })
  memberIds!: string[];
}

export class RenameGroupDto {
  @IsString()
  @Trim()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;
}

export class AddMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GROUP_MEMBERS)
  @IsUUID('all', { each: true })
  userIds!: string[];
}

export class SendMessageDto {
  /** @example Don't forget the test on Friday! */
  @IsString()
  @Trim()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  body!: string;
}

export class MessagesQueryDto {
  /** Id of the oldest message already loaded: returns the ones before it. */
  @IsOptional()
  @IsUUID()
  before?: string;

  /** @example 30 */
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 30;
}

// ----------------------------------------------------------------- outputs

/** A person in the chat. `id` is the user id. */
export class ChatUserDto {
  id!: string;
  /** @example Ioana */
  firstName!: string;
  /** @example Popescu */
  lastName!: string;
  @ApiProperty({ enum: Role, enumName: 'Role' })
  role!: Role;
  /** Students: their class. */
  class!: ClassSummaryDto | null;
}

/** Someone the user may write to, with a hint of who they are. */
export class ChatContactDto extends ChatUserDto {
  /** @example Mathematics · your homeroom teacher */
  detail!: string | null;
}

export class ChatSenderDto {
  id!: string;
  firstName!: string;
  lastName!: string;
}

export class MessageDto {
  id!: string;
  conversationId!: string;
  @ApiProperty({ enum: MessageKind, enumName: 'MessageKind' })
  kind!: MessageKind;
  /** Empty once deleted. */
  body!: string;
  /** Null if the sender's account was deleted. */
  sender!: ChatSenderDto | null;
  createdAt!: Date;
  deletedAt!: Date | null;
}

export class MessagePageDto {
  /** Oldest first. */
  data!: MessageDto[];
  /** Whether there are older messages. */
  hasMore!: boolean;
}

export class ConversationMemberDto {
  user!: ChatUserDto;
  @ApiProperty({ enum: ChatRole, enumName: 'ChatRole' })
  role!: ChatRole;
  /** Everything up to this moment was read; null = nothing yet. */
  lastReadAt!: Date | null;
}

export class ConversationDto {
  id!: string;
  @ApiProperty({ enum: ConversationType, enumName: 'ConversationType' })
  type!: ConversationType;
  /** The group's name, or the other person's name in a direct conversation. */
  name!: string;
  @ApiProperty({ enum: ChatRole, enumName: 'ChatRole' })
  myRole!: ChatRole;
  createdAt!: Date;
  lastMessageAt!: Date;
  lastMessage!: MessageDto | null;
  /** Messages from others the user hasn't read. */
  unreadCount!: number;
  members!: ConversationMemberDto[];
}

export class ChatUnreadCountDto {
  /** Unread messages in all conversations. @example 4 */
  count!: number;
}
