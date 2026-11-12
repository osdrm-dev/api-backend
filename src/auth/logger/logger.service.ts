import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { Logger as WinstonLogger } from 'winston';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: WinstonLogger,
  ) {}

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  // info (not http) so the response line survives LOG_LEVEL=info in prod.
  logHttp(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    userId?: number | string,
    traceId?: string,
  ) {
    this.logger.info(
      `${method} ${url} ${statusCode} - ${duration}ms [user=${userId ?? 'anonymous'} trace=${traceId ?? '-'}]`,
      {
        context: 'HTTP',
        method,
        url,
        statusCode,
        duration,
        userId,
        traceId,
      },
    );
  }
}
