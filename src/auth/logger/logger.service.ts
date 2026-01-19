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

  // Méthodes personnalisées pour l'audit
  logAuth(action: string, userId?: number, details?: any) {
    this.logger.info(`[AUTH] ${action}`, {
      context: 'Auth',
      userId,
      ...details,
    });
  }

  logHttp(method: string, url: string, statusCode: number, duration: number) {
    this.logger.http(`${method} ${url} ${statusCode} - ${duration}ms`, {
      context: 'HTTP',
      method,
      url,
      statusCode,
      duration,
    });
  }

  logDatabase(query: string, duration?: number) {
    this.logger.debug(`[DB] ${query}${duration ? ` (${duration}ms)` : ''}`, {
      context: 'Database',
      query,
      duration,
    });
  }

  logError(error: Error, context?: string) {
    this.logger.error(error.message, {
      context: context || 'Error',
      stack: error.stack,
      name: error.name,
    });
  }
}
