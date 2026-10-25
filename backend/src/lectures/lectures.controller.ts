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
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { Role } from '../generated/prisma/enums';
import {
  CreateLectureDto,
  FileLinkDto,
  LectureDetailDto,
  LectureHistoryDto,
  LectureHistoryQueryDto,
  LectureLinkQueryDto,
  LectureQueryDto,
  LectureStudentDto,
  PaginatedLecturesDto,
  SetLectureStudentsDto,
  UpdateLectureDto,
} from './dto/lecture.dto';
import { LecturesService } from './lectures.service';
import { MAX_LECTURE_BYTES } from './pdf';

@ApiTags('Lectures')
@ApiBearerAuth()
@ApiNotFoundResponse({ type: ErrorResponseDto })
@Controller('lectures')
export class LecturesController {
  constructor(private readonly lectures: LecturesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lectures, a page at a time',
    description:
      'Admins: every lecture. Teachers: their library. Students: the ones they can read. Newest first; `subjects` lists every subject they have lectures in, for filters. Lectures are not tied to a school year.',
  })
  @ApiOkResponse({ type: PaginatedLecturesDto })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: LectureQueryDto,
  ): Promise<PaginatedLecturesDto> {
    return this.lectures.findAll(user, query);
  }

  @Get('recipients')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Students a lecture can be shared with',
    description:
      'Every student of the open year, from any class (with their class), and the ones not in a class yet.',
  })
  @ApiOkResponse({ type: [LectureStudentDto] })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  recipients(): Promise<LectureStudentDto[]> {
    return this.lectures.recipients();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One lecture',
    description:
      'The teacher whose lecture it is and admins also get the students who can read it. Anyone else who may not read it gets 404.',
  })
  @ApiOkResponse({ type: LectureDetailDto })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LectureDetailDto> {
    return this.lectures.findOne(user, id);
  }

  @Get(':id/history')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Who got or lost access, and when',
    description:
      'Newest first, one entry per change (a change can be about many students), with who made it. For the teacher whose lecture it is and admins.',
  })
  @ApiOkResponse({ type: LectureHistoryDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  history(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LectureHistoryQueryDto,
  ): Promise<LectureHistoryDto> {
    return this.lectures.history(user, id, query);
  }

  @Get(':id/link')
  @ApiOperation({
    summary: 'A short-lived link to preview or download the PDF',
    description:
      'Works for FILE_LINK_SECONDS (5 minutes by default) without a login, so it can be opened in a new tab or an iframe. With S3 storage it is a pre-signed URL of the bucket, which stays private.',
  })
  @ApiOkResponse({ type: FileLinkDto })
  link(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LectureLinkQueryDto,
  ): Promise<FileLinkDto> {
    return this.lectures.link(user, id, query.download);
  }

  @Post()
  @Roles(Role.TEACHER)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_LECTURE_BYTES,
        files: 1,
        fields: 6,
        // studentIds can list many students.
        fieldSize: 100_000,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'subjectId', 'file'],
      properties: {
        title: { type: 'string', maxLength: 120 },
        description: { type: 'string', maxLength: 1000 },
        subjectId: {
          type: 'string',
          format: 'uuid',
          description: 'A subject the teacher teaches this school year.',
        },
        studentIds: {
          type: 'string',
          description:
            'Who may read it, from any class: a JSON array of student ids or a comma-separated list. Can be changed later.',
          example: '["0b39a733-7b2b-45e6-9d19-7938ad3af0b6"]',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'The PDF (at most 20 MB).',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Add a lecture (a PDF) to the library and share it',
    description:
      "The lecture stays in the teacher's library; the students it is shared with can read it until the teacher removes them. The file is checked to really be a PDF and stored privately (local folder or S3 bucket). The students it is shared with get a notification.",
  })
  @ApiCreatedResponse({ type: LectureDetailDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiPayloadTooLargeResponse({ type: ErrorResponseDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLectureDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<LectureDetailDto> {
    return this.lectures.create(user, dto, file);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Change the title, description or subject' })
  @ApiOkResponse({ type: LectureDetailDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLectureDto,
  ): Promise<LectureDetailDto> {
    return this.lectures.update(user, id, dto);
  }

  @Put(':id/students')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Choose who can read the lecture',
    description:
      "Replaces the list. Who got or lost access is written to the lecture's history. Students who just got access are notified; the others are not bothered again.",
  })
  @ApiOkResponse({ type: LectureDetailDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  setStudents(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetLectureStudentsDto,
  ): Promise<LectureDetailDto> {
    return this.lectures.setStudents(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lecture, its history and its file' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.lectures.remove(user, id);
  }
}
