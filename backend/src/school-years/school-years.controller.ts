import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
  ClosingPreviewDto,
  CloseYearDto,
  CloseYearResultDto,
  SaveReexamDto,
  SchoolYearDto,
  SchoolYearSummaryDto,
} from './dto/school-year.dto';
import { SchoolYearsService } from './school-years.service';

@ApiTags('School years')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponseDto })
@Controller('school-years')
export class SchoolYearsController {
  constructor(private readonly years: SchoolYearsService) {}

  @Get()
  @ApiOperation({
    summary: 'School years I can look at, newest first',
    description:
      'Admins get every year. Teachers and students get the years they had classes in, and the open one. Closed years are a read-only archive.',
  })
  @ApiOkResponse({ type: [SchoolYearSummaryDto] })
  list(@CurrentUser() user: AuthUser): Promise<SchoolYearSummaryDto[]> {
    return this.years.list(user);
  }

  @Get('current')
  @ApiOperation({ summary: 'The open school year and its current semester' })
  @ApiOkResponse({ type: SchoolYearDto })
  async current(): Promise<SchoolYearDto> {
    return this.years.toDto(await this.years.active());
  }

  @Post('current/end-semester')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'End the first semester',
    description:
      'New grades go to the second semester. Teachers can no longer change the grades of the first one; admins still can.',
  })
  @ApiOkResponse({ type: SchoolYearDto })
  @ApiConflictResponse({
    description: 'The second semester has already started',
    type: ErrorResponseDto,
  })
  endSemester(): Promise<SchoolYearDto> {
    return this.years.endSemester();
  }

  @Get('current/closing')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Preview the end of the school year',
    description:
      'Every student with their annual general average, the subjects they failed (annual average under 5, or none) and what the Romanian rules suggest: PROMOTED, GRADUATED (final grade), REEXAM (one or two subjects failed: re-exam results needed) or REPEATING (three or more, or a failed re-exam). Only in the second semester.',
  })
  @ApiOkResponse({ type: ClosingPreviewDto })
  @ApiConflictResponse({
    description: 'Still in the first semester',
    type: ErrorResponseDto,
  })
  closingPreview(): Promise<ClosingPreviewDto> {
    return this.years.closingPreview();
  }

  @Put('current/reexams')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Record the grade of a re-exam (examen de corigență)',
    description:
      'Only for a subject the student failed this year. The grade replaces the annual average of the subject.',
  })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  saveReexam(@Body() dto: SaveReexamDto): Promise<void> {
    return this.years.saveReexam(dto);
  }

  @Delete('current/reexams/:studentId/:subjectId')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the grade of a re-exam' })
  @ApiNoContentResponse()
  removeReexam(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ): Promise<void> {
    return this.years.removeReexam(studentId, subjectId);
  }

  @Post('current/close')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close the school year and open the next one',
    description:
      'Records every outcome (the suggestion, or the decision sent for a student), archives the year (read-only) and opens the next: each class continues a grade higher ("9A" becomes "10A") with its homeroom teacher, subjects and teachers and its promoted students; students repeating the year join the class of their grade; graduates leave. Optionally opens empty first-grade classes. The timetable is not copied.',
  })
  @ApiOkResponse({ type: CloseYearResultDto })
  @ApiBadRequestResponse({
    description: 'Re-exam results or decisions are missing',
    type: ErrorResponseDto,
  })
  close(@Body() dto: CloseYearDto): Promise<CloseYearResultDto> {
    return this.years.close(dto);
  }
}
