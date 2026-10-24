import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { Role } from '../generated/prisma/enums';
import { GradeScanResultDto, ScanTestsDto } from './dto/grade-scan.dto';
import {
  GradeScansService,
  MAX_SCAN_IMAGE_BYTES,
  MAX_SCAN_IMAGES,
} from './grade-scans.service';

@ApiTags('Grade scans (AI)')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.TEACHER)
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiBadRequestResponse({ type: ErrorResponseDto })
@Controller('classes/:id/grade-scans')
export class GradeScansController {
  constructor(private readonly gradeScans: GradeScansService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  // Every photo is an AI call that costs money, so this is limited per user IP.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FilesInterceptor('images', MAX_SCAN_IMAGES, {
      limits: { fileSize: MAX_SCAN_IMAGE_BYTES, fields: 5, fieldSize: 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subjectId', 'images'],
      properties: {
        subjectId: { type: 'string', format: 'uuid' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: `Photos of graded tests, one test per photo: JPEG, PNG, WebP or GIF, at most ${MAX_SCAN_IMAGES} photos of 8 MB each.`,
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Read grades from photos of tests (AI)',
    description:
      'An AI model (Gemini or Claude, see AI_PROVIDER) reads the student name and the final grade on each photo and matches the name to a student of the class. ' +
      'Nothing is saved and the photos are not stored: review the result, then save the grades with POST /classes/:id/grades. ' +
      'Without an AI key the results are simulated (mode "demo"). Teachers can only scan tests of a subject they teach in the class.',
  })
  @ApiOkResponse({ type: GradeScanResultDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiPayloadTooLargeResponse({
    type: ErrorResponseDto,
    description: 'A photo is larger than 8 MB or there are more than 20',
  })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  scan(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) classId: string,
    @Body() dto: ScanTestsDto,
    @UploadedFiles() images: Express.Multer.File[] = [],
  ): Promise<GradeScanResultDto> {
    return this.gradeScans.scan(user, classId, dto.subjectId, images);
  }
}
