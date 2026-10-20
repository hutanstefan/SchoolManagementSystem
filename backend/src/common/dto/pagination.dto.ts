import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../transformers';

export const MAX_PAGE_SIZE = 100;

/** Query parameters shared by every paginated list endpoint. */
export class PaginationQueryDto {
  /**
   * 1-based page number.
   * @example 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /**
   * Items per page (max 100).
   * @example 20
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;

  /** Sort direction. */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';

  /** Case-insensitive text search. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class PaginationMetaDto {
  /** @example 1 */
  page!: number;
  /** @example 20 */
  pageSize!: number;
  /** @example 62 */
  total!: number;
  /** @example 4 */
  totalPages!: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMetaDto;
}

/** Prisma `skip`/`take` for a page. */
export function pageArgs(query: PaginationQueryDto): {
  skip: number;
  take: number;
} {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function paginated<T>(
  data: T[],
  total: number,
  query: PaginationQueryDto,
): Paginated<T> {
  return {
    data,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}
