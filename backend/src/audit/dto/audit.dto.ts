import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { AuditKind, Role } from '../../generated/prisma/enums';
import { AUDIT_CATEGORIES, type AuditCategory } from '../audit-actions';

export class AuditLogQueryDto extends PickType(PaginationQueryDto, [
  'page',
  'pageSize',
  'search',
]) {
  @ApiPropertyOptional({ enum: AuditKind, enumName: 'AuditKind' })
  @IsOptional()
  @IsEnum(AuditKind)
  kind?: AuditKind;

  /** The part of the app. */
  @ApiPropertyOptional({ enum: AUDIT_CATEGORIES, enumName: 'AuditCategory' })
  @IsOptional()
  @IsIn(AUDIT_CATEGORIES)
  category?: AuditCategory;

  /** Only what this user did. */
  @IsOptional()
  @IsUUID()
  actorId?: string;

  /** Only what users with this role did. */
  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  /** From this day (inclusive). @example 2026-10-01 */
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  /** Up to this day (inclusive). @example 2026-10-31 */
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

export class AuditActorDto {
  /** The user id; null for failed logins or once the user was deleted. */
  id!: string | null;
  /** Their name when it happened. */
  name!: string | null;
  @ApiProperty({ enum: Role, enumName: 'Role', nullable: true })
  role!: Role | null;
}

export class AuditLogDto {
  id!: string;
  createdAt!: Date;
  @ApiProperty({ enum: AuditKind, enumName: 'AuditKind' })
  kind!: AuditKind;
  actor!: AuditActorDto;
  /** @example Grades */
  category!: string;
  /** @example Gave a grade */
  action!: string;
  /** @example 9 in Mathematics for Andrei Georgescu */
  target!: string | null;
  /** @example POST */
  method!: string | null;
  /** @example /api/grades */
  path!: string | null;
  /** How many records were created, changed or deleted. */
  changeCount!: number;
  ip!: string | null;
}

export class AuditChangeDto {
  /** The kind of record. @example Grade */
  model!: string;
  @ApiProperty({ enum: ['create', 'update', 'delete'] })
  op!: 'create' | 'update' | 'delete';
  id!: string | null;
  /** The record's name. @example 9 in Mathematics for Andrei Georgescu */
  label!: string | null;
  /** Field -> [before, after]; null on the missing side. Passwords are "[hidden]". */
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: {},
      minItems: 2,
      maxItems: 2,
    },
    example: { value: [7, 9] },
  })
  fields!: Record<string, [unknown, unknown]>;
}

export class AuditDetailsDto {
  changes!: AuditChangeDto[];
  /** Changes past the first 100: counted, not kept. */
  more!: number;
  /** Names of the records the ids in `fields` point to. */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { '0b39a733-7b2b-45e6-9d19-7938ad3af0b6': 'Andrei Georgescu' },
  })
  names!: Record<string, string>;
  /** Failed logins: the email that was tried. */
  email?: string;
  /** The HTTP status of a failed request. */
  status?: number;
}

export class AuditLogDetailDto extends AuditLogDto {
  userAgent!: string | null;
  details!: AuditDetailsDto;
}

export class PaginatedAuditLogsDto {
  data!: AuditLogDto[];
  meta!: PaginationMetaDto;
  /** Entries older than this many days are deleted every night; null: kept forever. */
  retentionDays!: number | null;
}
