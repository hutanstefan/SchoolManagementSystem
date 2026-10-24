import { Global, Module } from '@nestjs/common';
import { SchoolYearsController } from './school-years.controller';
import { SchoolYearsService } from './school-years.service';

/** Global: almost every module needs the open year and its semester. */
@Global()
@Module({
  controllers: [SchoolYearsController],
  providers: [SchoolYearsService],
  exports: [SchoolYearsService],
})
export class SchoolYearsModule {}
