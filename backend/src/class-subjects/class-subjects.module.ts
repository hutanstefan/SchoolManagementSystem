import { Module } from '@nestjs/common';
import { ClassSubjectsController } from './class-subjects.controller';
import { ClassSubjectsService } from './class-subjects.service';

@Module({
  controllers: [ClassSubjectsController],
  providers: [ClassSubjectsService],
})
export class ClassSubjectsModule {}
