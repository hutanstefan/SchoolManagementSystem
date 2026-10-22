import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { Role } from '../generated/prisma/enums';
import { ChatPolicyService } from './chat-policy.service';
import { ChatService } from './chat.service';
import {
  AddMembersDto,
  ChatContactDto,
  ChatUnreadCountDto,
  ContactsQueryDto,
  ConversationDto,
  CreateGroupDto,
  MessageDto,
  MessagePageDto,
  MessagesQueryDto,
  OpenDirectConversationDto,
  RenameGroupDto,
  SendMessageDto,
} from './dto/chat.dto';

/**
 * Chat between teachers and students (admins have none). Who may write to
 * whom is decided by ChatPolicyService; new messages are pushed live over
 * Socket.IO (event "chat:message").
 */
@ApiTags('Chat')
@ApiBearerAuth()
@Roles(Role.TEACHER, Role.STUDENT)
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly policy: ChatPolicyService,
  ) {}

  @Get('contacts')
  @ApiOperation({
    summary: 'People I can write to',
    description:
      'Teachers: other teachers and the students of their classes. Students: their teachers. Students talk to each other only in groups made by a teacher.',
  })
  @ApiOkResponse({ type: [ChatContactDto] })
  contacts(
    @CurrentUser() user: AuthUser,
    @Query() query: ContactsQueryDto,
  ): Promise<ChatContactDto[]> {
    return this.policy.contacts(user, query.search);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'My conversations, latest activity first' })
  @ApiOkResponse({ type: [ConversationDto] })
  list(@CurrentUser() user: AuthUser): Promise<ConversationDto[]> {
    return this.chat.list(user);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread messages in all my conversations' })
  @ApiOkResponse({ type: ChatUnreadCountDto })
  async unreadCount(
    @CurrentUser() user: AuthUser,
  ): Promise<ChatUnreadCountDto> {
    return { count: await this.chat.unreadTotal(user.id) };
  }

  @Post('conversations/direct')
  @ApiOperation({
    summary: 'Open the direct conversation with someone',
    description: 'Returns the existing one if there is one.',
  })
  @ApiCreatedResponse({ type: ConversationDto })
  openDirect(
    @CurrentUser() user: AuthUser,
    @Body() dto: OpenDirectConversationDto,
  ): Promise<ConversationDto> {
    return this.chat.openDirect(user, dto.userId);
  }

  @Post('conversations/group')
  @ApiOperation({
    summary: 'Create a group (teachers)',
    description:
      'With people the creator may write to, e.g. a teacher and the students of a class.',
  })
  @ApiCreatedResponse({ type: ConversationDto })
  createGroup(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGroupDto,
  ): Promise<ConversationDto> {
    return this.chat.createGroup(user, dto);
  }

  @Get('conversations/:id')
  @ApiOkResponse({ type: ConversationDto })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationDto> {
    return this.chat.findOne(user, id);
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Rename a group (its creator)' })
  @ApiOkResponse({ type: ConversationDto })
  rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameGroupDto,
  ): Promise<ConversationDto> {
    return this.chat.rename(user, id, dto.name);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a group with its messages (its creator)' })
  @ApiNoContentResponse()
  deleteGroup(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.chat.deleteGroup(user, id);
  }

  @Post('conversations/:id/members')
  @ApiOperation({ summary: 'Add people to a group (its creator)' })
  @ApiCreatedResponse({ type: ConversationDto })
  addMembers(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMembersDto,
  ): Promise<ConversationDto> {
    return this.chat.addMembers(user, id, dto.userIds);
  }

  @Delete('conversations/:id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove someone from a group, or leave it',
    description:
      'The creator removes members; anyone else can only remove themselves (leave).',
  })
  @ApiNoContentResponse()
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.chat.removeMember(user, id, userId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({
    summary: 'Messages of a conversation, newest page first',
    description:
      'Pass `before` (the id of the oldest message loaded) for the previous page.',
  })
  @ApiOkResponse({ type: MessagePageDto })
  messages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MessagesQueryDto,
  ): Promise<MessagePageDto> {
    return this.chat.messages(user, id, query);
  }

  @Post('conversations/:id/messages')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a message (at most 30 a minute)' })
  @ApiCreatedResponse({ type: MessageDto })
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageDto> {
    return this.chat.send(user, id, dto.body);
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark the conversation as read' })
  @ApiNoContentResponse()
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.chat.markRead(user, id);
  }

  @Delete('messages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of my messages' })
  @ApiNoContentResponse()
  deleteMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.chat.deleteMessage(user, id);
  }
}
