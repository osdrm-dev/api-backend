import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from './logger.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const startTime = Date.now();

    if (process.env.NODE_ENV !== 'production' && body) {
      const sanitizedBody = { ...body };
      for (const k of Object.keys(sanitizedBody)) {
        if (/password|token|secret/i.test(k)) sanitizedBody[k] = '***';
      }
      this.logger.debug(`Body: ${JSON.stringify(sanitizedBody)}`, 'HTTP');
    }

    // Errors are logged once by AllExceptionsFilter (with traceId), not here.
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        this.logger.logHttp(
          method,
          url,
          response.statusCode,
          Date.now() - startTime,
          request.user?.id,
          request.traceId,
        );
      }),
    );
  }
}
