import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { ChatPolicyService } from './chat-policy.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [RealtimeModule],
  controllers: [ChatController],
  providers: [ChatService, ChatPolicyService, ChatGateway],
})
export class ChatModule {}
