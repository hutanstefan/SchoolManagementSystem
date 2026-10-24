import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { Role } from '../generated/prisma/enums';
import {
  FreeSlotDto,
  TimetableConflictErrorDto,
} from './dto/timetable-conflict.dto';
import {
  CreateTimetableEntryDto,
  FreeSlotsQueryDto,
  TimetableDto,
  TimetableLessonDto,
  UpdateTimetableEntryDto,
} from './dto/timetable.dto';
import { YearQueryDto } from '../school-years/dto/school-year.dto';
import { TimetableService } from './timetable.service';

@ApiTags('Timetable')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiBadRequestResponse({
  type: ErrorResponseDto,
  description: 'Validation failed',
})
@Controller()
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get('timetable/me')
  @Roles(Role.TEACHER, Role.STUDENT)
  @ApiOperation({
    summary: 'My timetable',
    description:
      "Teachers get the lessons they teach. Students get their class's timetable (empty if they have no class).",
  })
  @ApiOkResponse({ type: TimetableDto })
  forCurrentUser(
    @CurrentUser() user: AuthUser,
    @Query() query: YearQueryDto,
  ): Promise<TimetableDto> {
    return this.timetableService.forCurrentUser(user, query.schoolYearId);
  }

  @Get('classes/:id/timetable')
  @ApiOperation({
    summary: 'Weekly timetable of a class',
    description:
      'Admins see every class, teachers the classes they are assigned to, students their own class.',
  })
  @ApiOkResponse({ type: TimetableDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  forClass(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) classId: string,
  ): Promise<TimetableDto> {
    return this.timetableService.forClass(user, classId);
  }

  @Get('teachers/:id/timetable')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Weekly timetable of a teacher (admin)' })
  @ApiOkResponse({ type: TimetableDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  forTeacher(
    @Param('id', ParseUUIDPipe) teacherId: string,
    @Query() query: YearQueryDto,
  ): Promise<TimetableDto> {
    return this.timetableService.forTeacher(teacherId, query.schoolYearId);
  }

  @Get('class-subjects/:id/free-slots')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Free slots for a subject of a class (admin)',
    description:
      "Slots where the class has no lesson and the subject's teacher teaches no other class. Used to suggest another slot after a conflict.",
  })
  @ApiOkResponse({ type: [FreeSlotDto] })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  freeSlots(
    @Param('id', ParseUUIDPipe) classSubjectId: string,
    @Query() query: FreeSlotsQueryDto,
  ): Promise<FreeSlotDto[]> {
    return this.timetableService.freeSlots(
      classSubjectId,
      query.excludeLessonId,
    );
  }

  @Post('classes/:id/timetable')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Add a lesson to a class timetable (admin)',
    description:
      'Rejected with 409 if the class or the teacher is busy in that slot, or the subject already has all its weekly hours.',
  })
  @ApiCreatedResponse({ type: TimetableLessonDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: TimetableConflictErrorDto,
    description:
      'Timetable conflict (CLASS_SLOT_TAKEN, TEACHER_BUSY or WEEKLY_HOURS_FULL)',
  })
  create(
    @Param('id', ParseUUIDPipe) classId: string,
    @Body() dto: CreateTimetableEntryDto,
  ): Promise<TimetableLessonDto> {
    return this.timetableService.create(classId, dto);
  }

  @Patch('timetable-entries/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Move a lesson to another slot or room (admin)' })
  @ApiOkResponse({ type: TimetableLessonDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: TimetableConflictErrorDto,
    description: 'Timetable conflict (CLASS_SLOT_TAKEN or TEACHER_BUSY)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimetableEntryDto,
  ): Promise<TimetableLessonDto> {
    return this.timetableService.update(id, dto);
  }

  @Delete('timetable-entries/:id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a lesson (admin)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.timetableService.remove(id);
  }
}
