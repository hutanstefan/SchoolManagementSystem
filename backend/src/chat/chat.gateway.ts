import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { Role } from '../generated/prisma/enums';
import { ClientEvents, userOf } from '../realtime/realtime.gateway';
import { ChatService } from './chat.service';

/** At most one "typing" per tab and conversation in this many ms... */
const TYPING_INTERVAL_MS = 1500;
/** ...and at most one per tab in this many ms, whatever the conversation. */
const ANY_TYPING_INTERVAL_MS = 200;
/** Conversations remembered per tab (a tab only types in a few). */
const MAX_TRACKED_CONVERSATIONS = 20;

/**
 * Chat events the browser sends over the shared connection (which
 * RealtimeGateway authenticates). Only "typing": messages are sent with the
 * REST API, so they are validated and rate-limited like any other request.
 */
@WebSocketGateway()
export class ChatGateway {
  private readonly lastTyping = new WeakMap<Socket, Map<string, number>>();

  constructor(private readonly chat: ChatService) {}

  @SubscribeMessage(ClientEvents.ChatTyping)
  async typing(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const user = userOf(socket);
    const conversationId = (body as { conversationId?: unknown } | null)
      ?.conversationId;
    // Admins have no chat.
    if (!user || user.role === Role.ADMIN) return;
    if (typeof conversationId !== 'string') return;
    if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return;

    // Each event costs a database lookup (is the user a member?), so a tab
    // sending many of them, e.g. for made-up conversations, is ignored.
    const seen = this.lastTyping.get(socket) ?? new Map<string, number>();
    const now = Date.now();
    const latest = Math.max(0, ...seen.values());
    if (now - latest < ANY_TYPING_INTERVAL_MS) return;
    if (now - (seen.get(conversationId) ?? 0) < TYPING_INTERVAL_MS) return;
    if (seen.size >= MAX_TRACKED_CONVERSATIONS) seen.clear();
    seen.set(conversationId, now);
    this.lastTyping.set(socket, seen);

    await this.chat.typing(user, conversationId);
  }
}
