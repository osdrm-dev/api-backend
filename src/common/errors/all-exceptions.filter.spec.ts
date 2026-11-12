import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AppException } from './app.exception';
import { ErrorCode } from './error-codes';

function run(exception: unknown, headersSent = false) {
  const json = jest.fn();
  const res: any = {
    headersSent,
    end: jest.fn(),
    status: jest.fn(() => ({ json })),
  };
  const req = { method: 'POST', url: '/suppliers', user: { id: 'u1' } };
  const host: any = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  };
  new AllExceptionsFilter().catch(exception, host);
  return { res, json, body: json.mock.calls[0]?.[0] };
}

const prismaError = (code: string, meta?: any) =>
  Object.assign(new Error('prisma boom'), {
    name: 'PrismaClientKnownRequestError',
    code,
    meta,
  });

describe('AllExceptionsFilter', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('AppException -> its code, fields, params', () => {
    const { res, body } = run(
      new AppException(
        HttpStatus.NOT_FOUND,
        'SUPPLIER_NOT_FOUND' as ErrorCode,
        'nope',
        { fields: [{ field: 'id', code: 'X' }], params: { id: 3 } },
      ),
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(body).toMatchObject({
      statusCode: 404,
      code: 'SUPPLIER_NOT_FOUND',
      message: 'nope',
      fields: [{ field: 'id', code: 'X' }],
      params: { id: 3 },
      path: '/suppliers',
    });
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('legacy NotFoundException("x") -> NOT_FOUND', () => {
    const { body } = run(new NotFoundException('x'));
    expect(body).toMatchObject({ code: 'NOT_FOUND', message: 'x' });
  });

  it('legacy BadRequestException with message array -> joined', () => {
    const { body } = run(new BadRequestException(['a', 'b']));
    expect(body).toMatchObject({ code: 'BAD_REQUEST', message: 'a, b' });
  });

  it('429 -> RATE_LIMITED', () => {
    const { body } = run(new HttpException('slow down', 429));
    expect(body.code).toBe('RATE_LIMITED');
  });

  it('Prisma P2002 with array target', () => {
    const { body } = run(prismaError('P2002', { target: ['email'] }));
    expect(body.statusCode).toBe(409);
    expect(body.code).toBe('CONFLICT');
    expect(body.fields).toEqual([{ field: 'email', code: 'CONFLICT' }]);
  });

  it('Prisma P2002 with string target', () => {
    const { body } = run(prismaError('P2002', { target: 'email' }));
    expect(body.fields).toEqual([{ field: 'email', code: 'CONFLICT' }]);
  });

  it('Prisma P2002 without target', () => {
    const { body } = run(prismaError('P2002'));
    expect(body.code).toBe('CONFLICT');
    expect(body.fields).toBeUndefined();
  });

  it('Prisma P2025 -> 404, P2003 -> 409', () => {
    expect(run(prismaError('P2025')).body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    expect(run(prismaError('P2003')).body).toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('plain Error -> 500 INTERNAL_ERROR without stack', () => {
    const { body } = run(new Error('db exploded'));
    expect(body).toMatchObject({
      statusCode: 500,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
    });
    expect(JSON.stringify(body)).not.toContain('db exploded');
    expect(body.stack).toBeUndefined();
  });

  it('logs 5xx with error+stack, 4xx with warn incl. code and user', () => {
    const e = new Error('db exploded');
    run(e);
    expect(error).toHaveBeenCalledWith(expect.any(String), e.stack);
    run(new NotFoundException('x'));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/NOT_FOUND.*u1/));
  });

  it('logs and ends the response when headers are already sent', () => {
    const { res } = run(new Error('late'), true);
    expect(res.status).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('after headers sent'),
      expect.stringContaining('late'),
    );
    expect(res.end).toHaveBeenCalled();
  });
});
