import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';

@Module({
  imports: [ClassesModule],
  controllers: [GradesController],
  providers: [GradesService],
})
export class GradesModule {}
