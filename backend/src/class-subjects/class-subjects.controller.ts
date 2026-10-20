import {
  Body,
  Controller,
  Delete,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { ClassSubjectSummaryDto } from '../classes/dto/class.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { Role } from '../generated/prisma/enums';
import { ClassSubjectsService } from './class-subjects.service';
import {
  CreateClassSubjectDto,
  UpdateClassSubjectDto,
} from './dto/class-subject.dto';

@ApiTags('Teaching assignments')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Admin only' })
@ApiBadRequestResponse({
  type: ErrorResponseDto,
  description: 'Validation failed',
})
@Controller()
export class ClassSubjectsController {
  constructor(private readonly classSubjectsService: ClassSubjectsService) {}

  @Post('classes/:id/subjects')
  @ApiOperation({
    summary: 'Add a subject to a class',
    description: 'Sets who teaches it (optional) and how many hours per week.',
  })
  @ApiCreatedResponse({ type: ClassSubjectSummaryDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Class, subject or teacher not found',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Subject already taught in the class',
  })
  create(
    @Param('id', ParseUUIDPipe) classId: string,
    @Body() dto: CreateClassSubjectDto,
  ): Promise<ClassSubjectSummaryDto> {
    return this.classSubjectsService.create(classId, dto);
  }

  @Patch('class-subjects/:id')
  @ApiOperation({
    summary: 'Change the teacher or the weekly hours of a subject in a class',
    description:
      'The new teacher must be free at every time the subject is scheduled, and the hours ' +
      "can't go below the lessons already in the timetable.",
  })
  @ApiOkResponse({ type: ClassSubjectSummaryDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Timetable conflict',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassSubjectDto,
  ): Promise<ClassSubjectSummaryDto> {
    return this.classSubjectsService.update(id, dto);
  }

  @Delete('class-subjects/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a subject from a class',
    description: 'Its lessons are removed from the timetable. Grades are kept.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.classSubjectsService.remove(id);
  }
}
