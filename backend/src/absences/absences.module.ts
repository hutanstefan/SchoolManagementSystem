import { Module } from '@nestjs/common';
import { AbsencesController } from './absences.controller';
import { AbsencesService } from './absences.service';

/** Absences: attendance, excuses and the limits per subject. */
@Module({
  controllers: [AbsencesController],
  providers: [AbsencesService],
})
export class AbsencesModule {}
