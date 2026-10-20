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
import {
  CreateTeacherDto,
  PaginatedTeachersDto,
  TeacherDetailDto,
  TeacherDto,
  TeacherQueryDto,
  UpdateTeacherDto,
} from './dto/teacher.dto';
import { TeachersService } from './teachers.service';

@ApiTags('Teachers')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@ApiForbiddenResponse({
  type: ErrorResponseDto,
  description: 'Admin only (except GET /teachers/me)',
})
@ApiBadRequestResponse({
  type: ErrorResponseDto,
  description: 'Validation failed',
})
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  @ApiOperation({ summary: 'List teachers (paginated, searchable)' })
  @ApiOkResponse({ type: PaginatedTeachersDto })
  findAll(@Query() query: TeacherQueryDto): Promise<Paginated<TeacherDto>> {
    return this.teachersService.findAll(query);
  }

  // Declared before ':id' so "me" is not parsed as an id.
  @Get('me')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary: 'My profile, classes and subjects (teacher)',
    description:
      'The logged-in teacher with their homeroom classes and teaching assignments.',
  })
  @ApiOkResponse({ type: TeacherDetailDto })
  findMe(@CurrentUser() user: AuthUser): Promise<TeacherDetailDto> {
    return this.teachersService.findMe(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a teacher with their classes and subjects' })
  @ApiOkResponse({ type: TeacherDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TeacherDetailDto> {
    return this.teachersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a teacher account' })
  @ApiCreatedResponse({ type: TeacherDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Email already in use',
  })
  create(@Body() dto: CreateTeacherDto): Promise<TeacherDto> {
    return this.teachersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a teacher (send password to reset it)' })
  @ApiOkResponse({ type: TeacherDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Email already in use',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherDto,
  ): Promise<TeacherDto> {
    return this.teachersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a teacher (their grades are kept)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.teachersService.remove(id);
  }
}
