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
import { PeriodQueryDto } from '../school-years/dto/school-year.dto';
import { AbsencesService } from './absences.service';
import {
  AbsenceDto,
  AbsenceQueryDto,
  AttendanceResultDto,
  ClassAbsencesDto,
  ExcuseAbsencesDto,
  ExcuseResultDto,
  PaginatedAbsencesDto,
  TakeAttendanceDto,
  UpdateAbsenceDto,
} from './dto/absence.dto';

@ApiTags('Absences')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponseDto })
@Controller()
export class AbsencesController {
  constructor(private readonly absences: AbsencesService) {}

  @Get('absences')
  @ApiOperation({
    summary: 'Absences, newest first',
    description:
      'Admins: every absence. Teachers: their homeroom classes, and the subjects they teach. Students: their own. The open year unless schoolYearId or classId says otherwise. `canChange` tells whether the user may excuse or delete each one.',
  })
  @ApiOkResponse({ type: PaginatedAbsencesDto })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: AbsenceQueryDto,
  ): Promise<PaginatedAbsencesDto> {
    return this.absences.findAll(user, query);
  }

  @Get('classes/:id/absences')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Absences of a class in a semester, by student and subject',
    description:
      "With how many subjects each student is over, or close to (80%), the limit. The class's homeroom teacher and admins.",
  })
  @ApiOkResponse({ type: ClassAbsencesDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  forClass(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PeriodQueryDto,
  ): Promise<ClassAbsencesDto> {
    return this.absences.forClass(user, id, query.semester);
  }

  @Post('absences/attendance')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Take attendance: record the students absent from a lesson',
    description:
      'In a subject the teacher teaches in the class (admins: any), in the current semester. One absence per student, subject and day. A student who comes close to, or goes over, the limit is notified, and so is the homeroom teacher.',
  })
  @ApiCreatedResponse({ type: AttendanceResultDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'The school year is closed',
  })
  takeAttendance(
    @CurrentUser() user: AuthUser,
    @Body() dto: TakeAttendanceDto,
  ): Promise<AttendanceResultDto> {
    return this.absences.takeAttendance(user, dto);
  }

  @Post('absences/excuse')
  @Roles(Role.ADMIN, Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Excuse a student's absences between two days",
    description:
      'Every unexcused absence of the open year in that period, in every subject, e.g. for a medical note. The homeroom teacher and admins.',
  })
  @ApiOkResponse({ type: ExcuseResultDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  excuseRange(
    @CurrentUser() user: AuthUser,
    @Body() dto: ExcuseAbsencesDto,
  ): Promise<ExcuseResultDto> {
    return this.absences.excuseRange(user, dto);
  }

  @Patch('absences/:id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Excuse an absence, or take the excuse back',
    description:
      'The teacher who recorded it, the homeroom teacher and admins, in the open year.',
  })
  @ApiOkResponse({ type: AbsenceDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAbsenceDto,
  ): Promise<AbsenceDto> {
    return this.absences.update(user, id, dto);
  }

  @Delete('absences/:id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an absence (recorded by mistake)',
    description:
      'The teacher who recorded it, the homeroom teacher and admins, in the open year.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.absences.remove(user, id);
  }
}
