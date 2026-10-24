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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { Paginated } from '../common/dto/pagination.dto';
import { Role } from '../generated/prisma/enums';
import {
  CreateGradeDto,
  CreateGradesBatchDto,
  GradebookDto,
  GradeDto,
  GradeHistoryEntryDto,
  GradeQueryDto,
  GradesBatchResultDto,
  PaginatedGradesDto,
  GradebookQueryDto,
  StudentGradesReportDto,
  StudentYearReportDto,
  UpdateGradeDto,
} from './dto/grade.dto';
import {
  PeriodQueryDto,
  YearQueryDto,
} from '../school-years/dto/school-year.dto';
import { GradesService } from './grades.service';

@ApiTags('Grades')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiBadRequestResponse({
  type: ErrorResponseDto,
  description: 'Validation failed',
})
@Controller()
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  // Declared before 'grades/:id' routes so "me" is not parsed as an id.
  @Get('grades/me')
  @Roles(Role.STUDENT)
  @ApiOperation({
    summary: 'My grades (student)',
    description:
      'Grades per subject with the subject average (two decimals and rounded to a whole grade, as in Romanian schools) and the overall average.',
  })
  @ApiOkResponse({ type: StudentGradesReportDto })
  myReport(
    @CurrentUser() user: AuthUser,
    @Query() query: PeriodQueryDto,
  ): Promise<StudentGradesReportDto> {
    return this.gradesService.myReport(user, query);
  }

  @Get('grades/me/year')
  @Roles(Role.STUDENT)
  @ApiOperation({
    summary: 'My whole school year',
    description:
      'Both semester averages of every subject, the annual averages, re-exams, the annual general average and, for a closed year, how it ended.',
  })
  @ApiOkResponse({ type: StudentYearReportDto })
  myYear(
    @CurrentUser() user: AuthUser,
    @Query() query: YearQueryDto,
  ): Promise<StudentYearReportDto> {
    return this.gradesService.myYear(user, query.schoolYearId);
  }

  @Get('grades')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'List grades (paginated, newest first)',
    description:
      'Admins see every grade. Teachers see the subjects they teach in each class, everything in their homeroom classes and every grade they gave.',
  })
  @ApiOkResponse({ type: PaginatedGradesDto })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: GradeQueryDto,
  ): Promise<Paginated<GradeDto>> {
    return this.gradesService.findAll(user, query);
  }

  @Post('grades')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Give a grade',
    description:
      "Teachers can only grade a subject they teach, in that student's class. The change is written to the grade history.",
  })
  @ApiCreatedResponse({ type: GradeDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGradeDto,
  ): Promise<GradeDto> {
    return this.gradesService.create(user, dto);
  }

  @Post('grades/batch')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Give grades to many students, in one or more classes, at once',
    description:
      "Like POST /classes/:id/grades, for students of several classes (an Excel import for all classes). Teachers must teach the subject in every student's class. Saved in one transaction: all grades or none.",
  })
  @ApiCreatedResponse({ type: GradesBatchResultDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  createManyAcrossClasses(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGradesBatchDto,
  ): Promise<GradesBatchResultDto> {
    return this.gradesService.createMany(user, null, dto);
  }

  @Post('classes/:id/grades')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Give grades to many students of a class at once',
    description:
      'One subject and date for the whole batch, one grade per student. Every entry is checked first and the batch is saved in one transaction: all grades or none. Used when grades are read from photos of tests.',
  })
  @ApiCreatedResponse({ type: GradesBatchResultDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  createMany(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) classId: string,
    @Body() dto: CreateGradesBatchDto,
  ): Promise<GradesBatchResultDto> {
    return this.gradesService.createMany(user, classId, dto);
  }

  @Patch('grades/:id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Change the value or date of a grade',
    description: 'Teachers can only change grades they gave.',
  })
  @ApiOkResponse({ type: GradeDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradeDto,
  ): Promise<GradeDto> {
    return this.gradesService.update(user, id, dto);
  }

  @Delete('grades/:id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a grade',
    description:
      'Teachers can only delete grades they gave. The grade history keeps a record.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.gradesService.remove(user, id);
  }

  @Get('grades/:id/history')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'History of a grade (admin)',
    description:
      'Who created, changed or deleted it, and when. Still available after deletion.',
  })
  @ApiOkResponse({ type: [GradeHistoryEntryDto] })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  history(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GradeHistoryEntryDto[]> {
    return this.gradesService.history(id);
  }

  @Get('students/:id/grades')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: "A student's grades and averages",
    description: "Admins, and teachers of the student's class.",
  })
  @ApiOkResponse({ type: StudentGradesReportDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  studentReport(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PeriodQueryDto,
  ): Promise<StudentGradesReportDto> {
    return this.gradesService.studentReport(user, id, query);
  }

  @Get('students/:id/grades/year')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: "A student's whole school year",
    description:
      'Semester and annual averages per subject, re-exams, the annual general average and the outcome of a closed year. Teachers: students of their classes that year.',
  })
  @ApiOkResponse({ type: StudentYearReportDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  studentYear(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: YearQueryDto,
  ): Promise<StudentYearReportDto> {
    return this.gradesService.studentYear(user, id, query.schoolYearId);
  }

  @Get('classes/:id/gradebook')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Gradebook of a subject in a class',
    description:
      'Every student of the class with their grades and average in that subject. Open to admins, the subject teacher and the homeroom teacher.',
  })
  @ApiQuery({ name: 'subjectId', required: true })
  @ApiOkResponse({ type: GradebookDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  gradebook(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) classId: string,
    @Query() query: GradebookQueryDto,
  ): Promise<GradebookDto> {
    return this.gradesService.gradebook(
      user,
      classId,
      query.subjectId,
      query.semester,
    );
  }
}
