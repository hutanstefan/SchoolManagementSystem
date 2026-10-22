import { Module } from '@nestjs/common';
import { GradesModule } from '../grades/grades.module';
import { GradeImportsController } from './grade-imports.controller';
import { GradeImportsService } from './grade-imports.service';

@Module({
  imports: [GradesModule],
  controllers: [GradeImportsController],
  providers: [GradeImportsService],
})
export class GradeImportsModule {}
