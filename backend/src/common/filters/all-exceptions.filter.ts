import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { ErrorResponseDto } from '../dto/error-response.dto';

interface ResolvedError {
  status: number;
  message: string | string[];
}

/** Friendly messages for unique constraints, by database index name. */
const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  users_email_key: 'Email already in use',
  classes_name_key: 'A class with this name already exists',
  subjects_name_key: 'A subject with this name already exists',
  class_subjects_class_id_subject_id_key:
    'This subject is already assigned to the class',
  timetable_entries_class_id_day_period_key:
    'The class already has a lesson in this slot',
};

/**
 * Turns every error into the same JSON shape:
 * { statusCode, error, message, path, timestamp }.
 *
 * Services throw Nest HTTP exceptions for expected cases. Prisma errors are a
 * safety net (for example two requests creating the same email at once) and are
 * mapped to proper status codes instead of a generic 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const { status, message } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseDto = {
      statusCode: status,
      error: this.statusText(status),
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const message =
        typeof res === 'object' && res !== null && 'message' in res
          ? (res as { message: string | string[] }).message
          : exception.message;
      return { status: exception.getStatus(), message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private resolvePrismaError(
    error: Prisma.PrismaClientKnownRequestError,
  ): ResolvedError {
    const cause = (
      error.meta as
        | {
            driverAdapterError?: {
              cause?: {
                originalMessage?: string;
                constraint?: { index?: string };
              };
            };
          }
        | undefined
    )?.driverAdapterError?.cause;
    const constraint = cause?.constraint?.index ?? '';

    switch (error.code) {
      case 'P2002': // unique constraint
        return {
          status: HttpStatus.CONFLICT,
          message:
            UNIQUE_CONSTRAINT_MESSAGES[constraint] ?? 'Resource already exists',
        };
      case 'P2025': // record to update/delete not found
        return {
          status: HttpStatus.NOT_FOUND,
          message: `${typeof error.meta?.modelName === 'string' ? error.meta.modelName : 'Resource'} not found`,
        };
      case 'P2003': // foreign key
        return cause?.originalMessage?.startsWith('update or delete')
          ? {
              status: HttpStatus.CONFLICT,
              message: 'The resource is still in use and cannot be deleted',
            }
          : {
              status: HttpStatus.BAD_REQUEST,
              message: 'A referenced resource does not exist',
            };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        };
    }
  }

  private statusText(status: number): string {
    const name = HttpStatus[status] as string | undefined;
    return name
      ? name
          .toLowerCase()
          .split('_')
          .map((word) => word[0].toUpperCase() + word.slice(1))
          .join(' ')
      : 'Error';
  }
}
