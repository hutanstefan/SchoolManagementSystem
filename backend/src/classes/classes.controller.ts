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
import { Paginated } from '../common/dto/pagination.dto';
import { Role } from '../generated/prisma/enums';
import { StudentDto } from '../students/dto/student.dto';
import { ClassesService } from './classes.service';
import {
  AssignStudentsDto,
  ClassDetailDto,
  ClassDto,
  ClassQueryDto,
  CreateClassDto,
  PaginatedClassesDto,
  UpdateClassDto,
} from './dto/class.dto';

@ApiTags('Classes')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.TEACHER)
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiBadRequestResponse({
  type: ErrorResponseDto,
  description: 'Validation failed',
})
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @ApiOperation({
    summary: 'List the classes of a school year',
    description:
      'The open year by default (`schoolYearId` for another). Admins get every class; teachers the classes they teach or are homeroom teacher of; students their own class.',
  })
  @ApiOkResponse({ type: PaginatedClassesDto })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ClassQueryDto,
  ): Promise<Paginated<ClassDto>> {
    return this.classesService.findAll(user, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @ApiOperation({
    summary: 'Get a class with its subjects and teachers',
    description:
      'Teachers can only open classes they are assigned to, students only their own class.',
  })
  @ApiOkResponse({ type: ClassDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClassDetailDto> {
    return this.classesService.findOne(user, id);
  }

  @Get(':id/students')
  @ApiOperation({
    summary: 'List the students enrolled in a class',
    description: 'Teachers can only list classes they are assigned to.',
  })
  @ApiOkResponse({ type: [StudentDto] })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  findStudents(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentDto[]> {
    return this.classesService.findStudents(user, id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a class (admin)' })
  @ApiCreatedResponse({ type: ClassDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Teacher not found',
  })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Name taken' })
  create(@Body() dto: CreateClassDto): Promise<ClassDto> {
    return this.classesService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Rename a class or change its homeroom teacher (admin)',
  })
  @ApiOkResponse({ type: ClassDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Name taken' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
  ): Promise<ClassDto> {
    return this.classesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a class (admin)',
    description:
      'Its students become unassigned. Its teaching assignments and timetable are deleted.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.classesService.remove(id);
  }

  @Post(':id/students')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign students to a class (admin)',
    description:
      'Moves the students into this class. Returns the updated class list.',
  })
  @ApiOkResponse({ type: [StudentDto] })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Class or student not found',
  })
  assignStudents(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignStudentsDto,
  ): Promise<StudentDto[]> {
    return this.classesService.assignStudents(id, dto.studentIds);
  }

  @Delete(':id/students/:studentId')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a student from a class (admin)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Student is not in this class',
  })
  unassignStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<void> {
    return this.classesService.unassignStudent(id, studentId);
  }
}
