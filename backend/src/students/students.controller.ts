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
import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { Paginated } from '../common/dto/pagination.dto';
import { Role } from '../generated/prisma/enums';
import {
  CreateStudentDto,
  PaginatedStudentsDto,
  StudentDetailDto,
  StudentDto,
  StudentQueryDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { YearQueryDto } from '../school-years/dto/school-year.dto';
import { StudentsService } from './students.service';

@ApiTags('Students')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Admin only' })
@ApiBadRequestResponse({
  type: ErrorResponseDto,
  description: 'Validation failed',
})
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List students (paginated, searchable, filterable by class)',
  })
  @ApiOkResponse({ type: PaginatedStudentsDto })
  findAll(@Query() query: StudentQueryDto): Promise<Paginated<StudentDto>> {
    return this.studentsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a student',
    description:
      'With their class in the school year asked for (the open one by default) and their classes year by year.',
  })
  @ApiOkResponse({ type: StudentDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: YearQueryDto,
  ): Promise<StudentDetailDto> {
    return this.studentsService.findOne(id, query.schoolYearId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a student account, optionally enrolled in a class',
  })
  @ApiCreatedResponse({ type: StudentDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Class not found',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Email already in use',
  })
  create(@Body() dto: CreateStudentDto): Promise<StudentDto> {
    return this.studentsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update a student (password resets it, classId moves or unassigns)',
  })
  @ApiOkResponse({ type: StudentDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Student or class not found',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Email already in use',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ): Promise<StudentDto> {
    return this.studentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a student and their grades' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.studentsService.remove(id);
  }
}
