import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { Role } from '../generated/prisma/enums';
import {
  GradeImportOptionDto,
  GradeImportResultDto,
  GradeTemplateQueryDto,
  ImportGradesDto,
} from './dto/grade-import.dto';
import { GradeImportsService, MAX_IMPORT_BYTES } from './grade-imports.service';

@ApiTags('Grade imports (Excel)')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.TEACHER)
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@Controller('grade-imports')
export class GradeImportsController {
  constructor(private readonly imports: GradeImportsService) {}

  @Get('options')
  @ApiOperation({
    summary: 'Subjects and classes the user can import grades for',
    description:
      'Admins: every subject taught in a class. Teachers: the subjects they teach, in the classes they teach them.',
  })
  @ApiOkResponse({ type: [GradeImportOptionDto] })
  options(@CurrentUser() user: AuthUser): Promise<GradeImportOptionDto[]> {
    return this.imports.options(user);
  }

  @Get('template')
  @ApiOperation({
    summary: 'Download an Excel template to fill in grades',
    description:
      'An .xlsx file with the class, registration number and name of every student, for one class or (without classId) every class where the user can grade the subject. The teacher types the grades and uploads it to POST /grade-imports.',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({
    description: 'The .xlsx file',
    schema: { type: 'string', format: 'binary' },
  })
  async template(
    @CurrentUser() user: AuthUser,
    @Query() query: GradeTemplateQueryDto,
  ): Promise<StreamableFile> {
    const { fileName, data } = await this.imports.template(
      user,
      query.subjectId,
      query.classId,
    );
    return new StreamableFile(data, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subjectId', 'file'],
      properties: {
        subjectId: { type: 'string', format: 'uuid' },
        classId: {
          type: 'string',
          format: 'uuid',
          description:
            'One class; leave it out for every class where the user can grade the subject.',
        },
        file: {
          type: 'string',
          format: 'binary',
          description:
            'The filled-in template (.xlsx) or a .csv file with a Grade column and the registration numbers or names of the students (at most 2 MB).',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Read grades from an Excel file',
    description:
      'Matches every row to a student by registration number, else by class and name, and checks the grades and dates. Nothing is saved: review the rows, then save them with POST /grades/batch.',
  })
  @ApiOkResponse({ type: GradeImportResultDto })
  preview(
    @CurrentUser() user: AuthUser,
    @Body() dto: ImportGradesDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<GradeImportResultDto> {
    return this.imports.preview(user, dto.subjectId, dto.classId, file);
  }
}
