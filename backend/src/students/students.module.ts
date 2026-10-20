import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [UsersModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
