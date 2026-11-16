import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AppException, ErrorParams, FieldError } from './app.exception';
import { ErrorCode } from './error-codes';

const STATUS_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  422: ErrorCode.UNPROCESSABLE,
  429: ErrorCode.RATE_LIMITED,
  503: ErrorCode.SERVICE_UNAVAILABLE,
};

type Normalized = {
  status: number;
  code: ErrorCode;
  message: string;
  fields?: FieldError[];
  params?: ErrorParams;
};

function codeForStatus(status: number): ErrorCode {
  return (
    STATUS_CODE[status] ??
    (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST)
  );
}

// Duck-typed so the generated Prisma client import path does not matter.
function fromPrisma(err: any): Normalized | null {
  if (err?.name !== 'PrismaClientKnownRequestError') return null;
  if (typeof err.code !== 'string') return null;
  switch (err.code) {
    case 'P2002': {
      const target = err.meta?.target;
      const names: string[] = Array.isArray(target)
        ? target
        : typeof target === 'string'
          ? [target]
          : [];
      return {
        status: HttpStatus.CONFLICT,
        code: ErrorCode.CONFLICT,
        message: 'Resource already exists',
        fields: names.length
          ? names.map((field) => ({ field, code: ErrorCode.CONFLICT }))
          : undefined,
      };
    }
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        code: ErrorCode.NOT_FOUND,
        message: 'Resource not found',
      };
    case 'P2003':
      return {
        status: HttpStatus.CONFLICT,
        code: ErrorCode.CONFLICT,
        message: 'Resource is referenced by or references another resource',
      };
    default:
      return null;
  }
}

function normalize(exception: unknown): Normalized {
  if (exception instanceof AppException) {
    return {
      status: exception.getStatus(),
      code: exception.code,
      message: exception.message,
      fields: exception.fields,
      params: exception.params,
    };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const raw = typeof body === 'string' ? body : (body as any)?.message;
    const message = Array.isArray(raw)
      ? raw.join(', ')
      : typeof raw === 'string' && raw
        ? raw
        : exception.message;
    return { status, code: codeForStatus(status), message };
  }
  return (
    fromPrisma(exception) ?? {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
    }
  );
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    const tag = `[user=${req.user?.id ?? 'anonymous'} trace=${req.traceId ?? '-'}]`;
    if (res.headersSent) {
      // Response already started: can't send JSON, so log and close the stream.
      this.logger.error(
        `${req.method} ${req.url}: error after headers sent ${tag}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      res.end();
      return;
    }

    const n = normalize(exception);
    const is5xx = n.status >= 500;
    // Never leak 5xx details to the client.
    const message = is5xx ? 'Internal server error' : n.message;
    const code = n.code;

    const line = `${req.method} ${req.url} -> ${n.status} ${code}: ${n.message} ${tag}`;
    if (is5xx) {
      this.logger.error(
        line,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(line);
    }

    res.status(n.status).json({
      statusCode: n.status,
      code,
      message,
      fields: n.fields,
      params: n.params,
      path: req.url,
      traceId: req.traceId,
      timestamp: new Date().toISOString(),
    });
  }
}
