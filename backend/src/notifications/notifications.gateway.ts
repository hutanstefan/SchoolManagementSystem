import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AccessTokenService } from '../auth/access-token.service';
import type { AuthUser } from '../auth/auth.types';
import { DomainEvents, type SessionEndedEvent } from '../events/domain-events';

/** Events the server sends to a user's browser tabs. */
export const ServerEvents = {
  /** A new notification (NotificationDto). */
  Notification: 'notification',
  /** Notifications were marked as read in another tab: refresh the counter. */
  NotificationsRead: 'notifications:read',
} as const;

const roomOf = (userId: string) => `user:${userId}`;

/**
 * The live connection of every logged-in browser tab (Socket.IO, at
 * /api/socket.io; CORS and path are set by SocketIoAdapter). A tab proves
 * who it is with its access token in the handshake, checked exactly like an
 * HTTP request; it then joins its user's room, so every tab of that user
 * gets the user's notifications.
 */
@WebSocketGateway()
export class NotificationsGateway implements OnGatewayInit {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private readonly server?: Server;

  constructor(private readonly accessTokens: AccessTokenService) {}

  afterInit(server: Server): void {
    // Runs before a connection is accepted: no valid token, no connection.
    server.use((socket: Socket, next) => {
      const token = (socket.handshake.auth as { token?: unknown }).token;
      this.accessTokens
        .verify(typeof token === 'string' ? token : null)
        .then(async (user: AuthUser) => {
          (socket.data as { user?: AuthUser }).user = user;
          await socket.join(roomOf(user.id));
          next();
        })
        .catch((error: Error) => next(new Error(error.message)));
    });
  }

  /** Sends an event to every open tab of a user. */
  sendToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(roomOf(userId)).emit(event, payload);
  }

  /** After a logout, the user's open connections are closed too. */
  @OnEvent(DomainEvents.SessionEnded)
  disconnectUser({ userId }: SessionEndedEvent): void {
    this.server?.in(roomOf(userId)).disconnectSockets(true);
    this.logger.debug(`Closed the connections of user ${userId}`);
  }
}
