import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import {
  ChatRole,
  ConversationType,
  MessageKind,
  Prisma,
  Role,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway, ServerEvents } from '../realtime/realtime.gateway';
import { ChatPolicyService } from './chat-policy.service';
import {
  ConversationDto,
  CreateGroupDto,
  MessageDto,
  MessagePageDto,
  MessagesQueryDto,
} from './dto/chat.dto';
import { systemMessages } from './system-messages';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  student: { select: { class: { select: { id: true, name: true } } } },
} as const satisfies Prisma.UserSelect;

const messageSelect = {
  id: true,
  conversationId: true,
  kind: true,
  body: true,
  createdAt: true,
  deletedAt: true,
  sender: { select: { id: true, firstName: true, lastName: true } },
} as const satisfies Prisma.MessageSelect;

const conversationSelect = {
  id: true,
  type: true,
  name: true,
  createdAt: true,
  lastMessageAt: true,
  members: {
    select: {
      role: true,
      joinedAt: true,
      lastReadAt: true,
      user: { select: userSelect },
    },
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
  },
  messages: {
    select: messageSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
} as const satisfies Prisma.ConversationSelect;

type ConversationRow = Prisma.ConversationGetPayload<{
  select: typeof conversationSelect;
}>;
type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;
type Tx = Prisma.TransactionClient;

const fullName = (u: { firstName: string; lastName: string }) =>
  `${u.firstName} ${u.lastName}`;

/**
 * Direct conversations and groups. Everything is saved through the REST API
 * (validated, rate-limited, testable), then pushed to the members' open tabs
 * over the shared Socket.IO connection.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: ChatPolicyService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // -------------------------------------------------------- conversations

  /**
   * The user's conversations, latest activity first. A direct conversation
   * someone opened but hasn't written in yet is only shown to them.
   */
  async list(user: AuthUser): Promise<ConversationDto[]> {
    const rows = await this.prisma.conversation.findMany({
      where: {
        members: { some: { userId: user.id } },
        OR: [
          { type: ConversationType.GROUP },
          { createdById: user.id },
          { messages: { some: {} } },
        ],
      },
      select: conversationSelect,
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    });
    const unread = await this.unreadByConversation(user.id);
    return rows.map((row) => toConversation(row, user.id, unread.get(row.id)));
  }

  async findOne(user: AuthUser, id: string): Promise<ConversationDto> {
    const row = await this.prisma.conversation.findFirst({
      where: { id, members: { some: { userId: user.id } } },
      select: conversationSelect,
    });
    if (!row) throw new NotFoundException('Conversation not found');
    const unread = await this.unreadByConversation(user.id, id);
    return toConversation(row, user.id, unread.get(id));
  }

  /** Unread messages in all conversations (the badge on "Messages"). */
  async unreadTotal(userId: string): Promise<number> {
    let total = 0;
    for (const count of (await this.unreadByConversation(userId)).values()) {
      total += count;
    }
    return total;
  }

  /** The direct conversation with someone: the existing one, or a new one. */
  async openDirect(user: AuthUser, otherId: string): Promise<ConversationDto> {
    if (otherId === user.id) {
      throw new BadRequestException(
        "You can't start a conversation with yourself",
      );
    }
    const other = await this.prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true },
    });
    if (!other) throw new NotFoundException('User not found');
    await this.policy.assertCanReach(user, [otherId]);

    const directKey = [user.id, otherId].sort().join(':');
    const existing = await this.prisma.conversation.findUnique({
      where: { directKey },
      select: { id: true },
    });
    if (existing) return this.findOne(user, existing.id);

    try {
      const created = await this.prisma.conversation.create({
        data: {
          type: ConversationType.DIRECT,
          directKey,
          createdById: user.id,
          members: { create: [{ userId: user.id }, { userId: otherId }] },
        },
        select: { id: true },
      });
      return this.findOne(user, created.id);
    } catch (error) {
      // Both opened it at the same moment: the unique key kept only one.
      if (isUniqueViolation(error)) {
        const winner = await this.prisma.conversation.findUniqueOrThrow({
          where: { directKey },
          select: { id: true },
        });
        return this.findOne(user, winner.id);
      }
      throw error;
    }
  }

  /** Teachers create groups, with people they may write to. */
  async createGroup(
    user: AuthUser,
    dto: CreateGroupDto,
  ): Promise<ConversationDto> {
    if (user.role !== Role.TEACHER) {
      throw new ForbiddenException('Only teachers can create groups');
    }
    const memberIds = [...new Set(dto.memberIds)].filter(
      (id) => id !== user.id,
    );
    if (memberIds.length === 0) {
      throw new BadRequestException('Add at least one other member');
    }
    await this.policy.assertCanReach(user, memberIds);
    const actor = await this.nameOf(user.id);

    const created = await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          type: ConversationType.GROUP,
          name: dto.name,
          createdById: user.id,
          members: {
            create: [
              { userId: user.id, role: ChatRole.OWNER, lastReadAt: new Date() },
              ...memberIds.map((userId) => ({ userId })),
            ],
          },
        },
        select: { id: true },
      });
      await this.writeSystemMessage(
        tx,
        conversation.id,
        user.id,
        systemMessages.created(actor, dto.name),
      );
      return conversation;
    });

    this.realtime.sendToUsers(
      [user.id, ...memberIds],
      ServerEvents.ChatConversation,
      {
        conversationId: created.id,
      },
    );
    return this.findOne(user, created.id);
  }

  async rename(
    user: AuthUser,
    id: string,
    name: string,
  ): Promise<ConversationDto> {
    const group = await this.ownedGroup(user, id);
    if (group.name === name) return this.findOne(user, id);
    const actor = await this.nameOf(user.id);

    const message = await this.prisma.$transaction(async (tx) => {
      await tx.conversation.update({ where: { id }, data: { name } });
      return this.writeSystemMessage(
        tx,
        id,
        user.id,
        systemMessages.renamed(actor, name),
      );
    });
    this.broadcastMessage(group.memberIds, message);
    this.realtime.sendToUsers(group.memberIds, ServerEvents.ChatConversation, {
      conversationId: id,
    });
    return this.findOne(user, id);
  }

  async addMembers(
    user: AuthUser,
    id: string,
    userIds: string[],
  ): Promise<ConversationDto> {
    const group = await this.ownedGroup(user, id);
    const current = new Set(group.memberIds);
    const added = [...new Set(userIds)].filter(
      (userId) => !current.has(userId),
    );
    if (added.length === 0) {
      throw new BadRequestException('They are already in the group');
    }
    await this.policy.assertCanReach(user, added);

    const [actor, people] = await Promise.all([
      this.nameOf(user.id),
      this.prisma.user.findMany({
        where: { id: { in: added } },
        select: { firstName: true, lastName: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
    ]);
    const message = await this.prisma.$transaction(async (tx) => {
      await tx.conversationMember.createMany({
        data: added.map((userId) => ({ conversationId: id, userId })),
      });
      return this.writeSystemMessage(
        tx,
        id,
        user.id,
        systemMessages.added(actor, people.map(fullName)),
      );
    });

    const everyone = [...group.memberIds, ...added];
    this.broadcastMessage(everyone, message);
    this.realtime.sendToUsers(everyone, ServerEvents.ChatConversation, {
      conversationId: id,
    });
    return this.findOne(user, id);
  }

  /**
   * The owner removes a member, or a member leaves. The owner can't leave
   * (they would leave the group without anyone to manage it): they delete it.
   */
  async removeMember(
    user: AuthUser,
    id: string,
    userId: string,
  ): Promise<void> {
    const group = await this.groupOf(user, id);
    const leaving = userId === user.id;
    if (leaving && group.myRole === ChatRole.OWNER) {
      throw new BadRequestException(
        "You created this group, so you can't leave it. Delete it instead.",
      );
    }
    if (!leaving && group.myRole !== ChatRole.OWNER) {
      throw new ForbiddenException(
        'Only the creator of the group can remove members',
      );
    }
    if (!group.memberIds.includes(userId)) {
      throw new NotFoundException('This person is not in the group');
    }

    const [actor, removed] = await Promise.all([
      this.nameOf(user.id),
      this.nameOf(userId),
    ]);
    const message = await this.prisma.$transaction(async (tx) => {
      await tx.conversationMember.delete({
        where: { conversationId_userId: { conversationId: id, userId } },
      });
      return this.writeSystemMessage(
        tx,
        id,
        user.id,
        leaving
          ? systemMessages.left(removed)
          : systemMessages.removed(actor, removed),
      );
    });

    const remaining = group.memberIds.filter((member) => member !== userId);
    this.broadcastMessage(remaining, message);
    this.realtime.sendToUsers(group.memberIds, ServerEvents.ChatConversation, {
      conversationId: id,
    });
  }

  async deleteGroup(user: AuthUser, id: string): Promise<void> {
    const group = await this.ownedGroup(user, id);
    await this.prisma.conversation.delete({ where: { id } });
    this.realtime.sendToUsers(group.memberIds, ServerEvents.ChatConversation, {
      conversationId: id,
    });
  }

  // ------------------------------------------------------------- messages

  /**
   * A page of messages, newest page first, each page oldest message first.
   * Members only see what was written after they joined.
   */
  async messages(
    user: AuthUser,
    conversationId: string,
    query: MessagesQueryDto,
  ): Promise<MessagePageDto> {
    const member = await this.membership(user.id, conversationId);

    let cursor: Prisma.MessageWhereInput = {};
    if (query.before) {
      const before = await this.prisma.message.findFirst({
        where: { id: query.before, conversationId },
        select: { id: true, createdAt: true },
      });
      if (!before) throw new BadRequestException('Unknown message');
      // Same timestamp: the id breaks the tie, so no message is skipped.
      cursor = {
        OR: [
          { createdAt: { lt: before.createdAt } },
          { createdAt: before.createdAt, id: { lt: before.id } },
        ],
      };
    }

    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        createdAt: { gte: member.joinedAt },
        ...cursor,
      },
      select: messageSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    return {
      data: rows.slice(0, query.limit).reverse().map(toMessage),
      hasMore,
    };
  }

  async send(
    user: AuthUser,
    conversationId: string,
    body: string,
  ): Promise<MessageDto> {
    await this.membership(user.id, conversationId);
    const now = new Date();

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId, senderId: user.id, body, createdAt: now },
        select: messageSelect,
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      });
      // Writing a message means having read the conversation.
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: user.id } },
        data: { lastReadAt: now },
      });
      return created;
    });

    this.broadcastMessage(await this.memberIds(conversationId), message);
    return toMessage(message);
  }

  /** Marks everything in the conversation as read; others see "Seen". */
  async markRead(user: AuthUser, conversationId: string): Promise<void> {
    await this.membership(user.id, conversationId);
    const lastReadAt = new Date();
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: { lastReadAt },
    });
    this.realtime.sendToUsers(
      await this.memberIds(conversationId),
      ServerEvents.ChatRead,
      { conversationId, userId: user.id, lastReadAt },
    );
  }

  /** Senders can delete their own messages; the place in the thread stays. */
  async deleteMessage(user: AuthUser, messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        conversationId: true,
        senderId: true,
        kind: true,
        deletedAt: true,
        conversation: { select: { members: { where: { userId: user.id } } } },
      },
    });
    if (!message || message.conversation.members.length === 0) {
      throw new NotFoundException('Message not found');
    }
    if (message.senderId !== user.id || message.kind !== MessageKind.TEXT) {
      throw new ForbiddenException('You can only delete your own messages');
    }
    if (message.deletedAt) return;

    await this.prisma.message.update({
      where: { id: messageId },
      data: { body: '', deletedAt: new Date() },
    });
    this.realtime.sendToUsers(
      await this.memberIds(message.conversationId),
      ServerEvents.ChatMessageDeleted,
      { conversationId: message.conversationId, messageId },
    );
  }

  /** "Someone is typing", sent to the other members (not saved). */
  async typing(user: AuthUser, conversationId: string): Promise<void> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true, user: { select: { firstName: true } } },
    });
    const me = members.find((m) => m.userId === user.id);
    if (!me) return;
    this.realtime.sendToUsers(
      members.filter((m) => m.userId !== user.id).map((m) => m.userId),
      ServerEvents.ChatTyping,
      { conversationId, user: { id: user.id, firstName: me.user.firstName } },
    );
  }

  // -------------------------------------------------------------- helpers

  /** Not a member = not found, so ids of other people's chats reveal nothing. */
  private async membership(userId: string, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { role: true, joinedAt: true },
    });
    if (!member) throw new NotFoundException('Conversation not found');
    return member;
  }

  private async groupOf(user: AuthUser, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, members: { some: { userId: user.id } } },
      select: {
        type: true,
        name: true,
        members: { select: { userId: true, role: true } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('This is not a group');
    }
    return {
      name: conversation.name,
      memberIds: conversation.members.map((m) => m.userId),
      myRole: conversation.members.find((m) => m.userId === user.id)!.role,
    };
  }

  private async ownedGroup(user: AuthUser, id: string) {
    const group = await this.groupOf(user, id);
    if (group.myRole !== ChatRole.OWNER) {
      throw new ForbiddenException('Only the creator of the group can do this');
    }
    return group;
  }

  private async memberIds(conversationId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  private async nameOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    return user ? fullName(user) : 'Someone';
  }

  private async writeSystemMessage(
    tx: Tx,
    conversationId: string,
    actorId: string,
    body: string,
  ): Promise<MessageRow> {
    const now = new Date();
    const message = await tx.message.create({
      data: {
        conversationId,
        senderId: actorId,
        kind: MessageKind.SYSTEM,
        body,
        createdAt: now,
      },
      select: messageSelect,
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    });
    return message;
  }

  private broadcastMessage(userIds: string[], message: MessageRow): void {
    this.realtime.sendToUsers(userIds, ServerEvents.ChatMessage, {
      conversationId: message.conversationId,
      message: toMessage(message),
    });
  }

  /**
   * Unread messages per conversation: text messages from others, after the
   * user last read the conversation (or joined it), not deleted.
   */
  private async unreadByConversation(
    userId: string,
    conversationId?: string,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<
      { conversation_id: string; count: bigint }[]
    >`
      SELECT m.conversation_id, COUNT(*) AS count
      FROM messages m
      JOIN conversation_members cm
        ON cm.conversation_id = m.conversation_id AND cm.user_id = ${userId}::uuid
      WHERE m.kind = 'TEXT'
        AND m.deleted_at IS NULL
        AND m.sender_id IS DISTINCT FROM ${userId}::uuid
        AND m.created_at > GREATEST(cm.joined_at, COALESCE(cm.last_read_at, cm.joined_at))
        ${conversationId ? Prisma.sql`AND m.conversation_id = ${conversationId}::uuid` : Prisma.empty}
      GROUP BY m.conversation_id
    `;
    return new Map(rows.map((r) => [r.conversation_id, Number(r.count)]));
  }
}

function toMessage(row: MessageRow): MessageDto {
  return {
    id: row.id,
    conversationId: row.conversationId,
    kind: row.kind,
    body: row.deletedAt ? '' : row.body,
    sender: row.sender,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
  };
}

function toConversation(
  row: ConversationRow,
  userId: string,
  unreadCount = 0,
): ConversationDto {
  // The creator first, then teachers, then students.
  const rank = { ADMIN: 1, TEACHER: 1, STUDENT: 2 } as const;
  const sorted = [...row.members].sort(
    (a, b) =>
      (a.role === ChatRole.OWNER ? 0 : rank[a.user.role]) -
      (b.role === ChatRole.OWNER ? 0 : rank[b.user.role]),
  );
  const members = sorted.map((m) => ({
    user: {
      id: m.user.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      role: m.user.role,
      class: m.user.student?.class ?? null,
    },
    role: m.role,
    lastReadAt: m.lastReadAt,
  }));
  const me = row.members.find((m) => m.user.id === userId);
  const other = members.find((m) => m.user.id !== userId);
  return {
    id: row.id,
    type: row.type,
    name:
      row.type === ConversationType.GROUP
        ? (row.name ?? 'Group')
        : other
          ? fullName(other.user)
          : 'Deleted user',
    myRole: me?.role ?? ChatRole.MEMBER,
    createdAt: row.createdAt,
    lastMessageAt: row.lastMessageAt,
    lastMessage: row.messages[0] ? toMessage(row.messages[0]) : null,
    unreadCount,
    members,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
