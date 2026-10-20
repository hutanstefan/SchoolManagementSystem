import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';

@Module({
  imports: [UsersModule],
  controllers: [TeachersController],
  providers: [TeachersService],
})
export class TeachersModule {}
