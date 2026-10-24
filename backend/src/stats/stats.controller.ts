import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { Role } from '../generated/prisma/enums';
import { SchoolStatsDto, TeachingStatsDto } from './dto/stats.dto';
import { PeriodQueryDto } from '../school-years/dto/school-year.dto';
import { StatsService } from './stats.service';

@ApiTags('Stats')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponseDto })
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('school')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'The whole school at a glance (admin dashboard)',
    description:
      'Of a school year and semester (the current ones by default): average, grade distribution, averages per class and subject, students at risk and grades given per week.',
  })
  @ApiOkResponse({ type: SchoolStatsDto })
  school(@Query() query: PeriodQueryDto): Promise<SchoolStatsDto> {
    return this.stats.school(query);
  }

  @Get('teaching')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary: 'My classes at a glance (teacher dashboard)',
    description:
      'For each subject the teacher teaches in a class: the class average, students at risk and students missing grades.',
  })
  @ApiOkResponse({ type: TeachingStatsDto })
  teaching(
    @CurrentUser() user: AuthUser,
    @Query() query: PeriodQueryDto,
  ): Promise<TeachingStatsDto> {
    return this.stats.teaching(user, query);
  }
}
