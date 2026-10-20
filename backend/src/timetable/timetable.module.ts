import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';

@Module({
  imports: [ClassesModule],
  controllers: [TimetableController],
  providers: [TimetableService],
})
export class TimetableModule {}
