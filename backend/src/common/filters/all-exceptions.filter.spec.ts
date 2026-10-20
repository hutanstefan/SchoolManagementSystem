import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ url: '/api/test', method: 'GET' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);
  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0],
  };
}

function prismaError(code: string, meta: Record<string, unknown> = {}) {
  return new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
    meta,
  });
}

describe('AllExceptionsFilter', () => {
  beforeAll(() => {
    // 500 errors are logged; keep the test output clean.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('keeps the status and message of HTTP exceptions', () => {
    const { status, body } = run(new NotFoundException('Student not found'));

    expect(status).toBe(404);
    expect(body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Student not found',
      path: '/api/test',
    });
  });

  it('keeps the list of validation messages', () => {
    const { body } = run(
      new BadRequestException(['email must be an email', 'name too long']),
    );
    expect(body.message).toEqual(['email must be an email', 'name too long']);
  });

  it('maps a unique violation (P2002) to 409 with a friendly message', () => {
    const { status, body } = run(
      prismaError('P2002', {
        driverAdapterError: {
          cause: { constraint: { index: 'users_email_key' } },
        },
      }),
    );
    expect(status).toBe(409);
    expect(body.message).toBe('Email already in use');
  });

  it('maps a missing record (P2025) to 404', () => {
    const { status, body } = run(prismaError('P2025', { modelName: 'Class' }));
    expect(status).toBe(404);
    expect(body.message).toBe('Class not found');
  });

  it('maps deleting a record still in use (P2003) to 409', () => {
    const { status } = run(
      prismaError('P2003', {
        driverAdapterError: {
          cause: { originalMessage: 'update or delete on table "subjects"' },
        },
      }),
    );
    expect(status).toBe(409);
  });

  it('hides the details of unexpected errors', () => {
    const { status, body } = run(new Error('secret connection string'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
  });
});
