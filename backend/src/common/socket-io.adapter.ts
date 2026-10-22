import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/** Socket.IO lives under /api like the REST API, so one proxy rule covers both. */
export const SOCKET_IO_PATH = '/api/socket.io';

/** Socket.IO with the same allowed origins as the REST API. */
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      path: SOCKET_IO_PATH,
      cors: { origin: this.origins, credentials: true },
    });
  }
}
