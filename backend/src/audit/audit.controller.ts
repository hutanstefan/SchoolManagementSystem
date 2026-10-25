import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { Role } from '../generated/prisma/enums';
import { AuditRetentionService } from './audit-retention.service';
import { AuditService } from './audit.service';
import {
  AuditLogDetailDto,
  AuditLogQueryDto,
  PaginatedAuditLogsDto,
} from './dto/audit.dto';

@ApiTags('Activity log')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponseDto })
@Roles(Role.ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly retention: AuditRetentionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'The activity log (admin)',
    description:
      'Every action that changed something, every login and logout, and every failed login, newest first. Filter by kind, part of the app, user, role, days or text. Entries older than AUDIT_RETENTION_DAYS are deleted every night (`retentionDays`).',
  })
  @ApiOkResponse({ type: PaginatedAuditLogsDto })
  async list(@Query() query: AuditLogQueryDto): Promise<PaginatedAuditLogsDto> {
    return {
      ...(await this.audit.list(query)),
      retentionDays: this.retention.retentionDays,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One entry of the activity log, with what changed (admin)',
    description:
      'Each record created, changed or deleted, with its fields before and after. Passwords are never logged.',
  })
  @ApiOkResponse({ type: AuditLogDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AuditLogDetailDto> {
    return this.audit.findOne(id);
  }
}
