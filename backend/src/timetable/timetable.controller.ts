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
  CreateTimetableEntryDto,
  TimetableDto,
  TimetableLessonDto,
  UpdateTimetableEntryDto,
} from './dto/timetable.dto';
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
  forCurrentUser(@CurrentUser() user: AuthUser): Promise<TimetableDto> {
    return this.timetableService.forCurrentUser(user);
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
  ): Promise<TimetableDto> {
    return this.timetableService.forTeacher(teacherId);
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
    type: ErrorResponseDto,
    description: 'Timetable conflict',
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
    type: ErrorResponseDto,
    description: 'Timetable conflict',
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
