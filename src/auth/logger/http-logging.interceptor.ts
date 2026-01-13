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
    const { method, url, body, headers } = request;
    const startTime = Date.now();

    // Logger la requête entrante
    this.logger.log(`➡️  Incoming ${method} ${url}`, 'HTTP');

    // Logger le body en développement (sans les mots de passe)
    if (process.env.NODE_ENV !== 'production' && body) {
      const sanitizedBody = { ...body };
      if (sanitizedBody.password) sanitizedBody.password = '***';
      if (sanitizedBody.oldPassword) sanitizedBody.oldPassword = '***';
      if (sanitizedBody.newPassword) sanitizedBody.newPassword = '***';
      this.logger.debug(`Body: ${JSON.stringify(sanitizedBody)}`, 'HTTP');
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;

          this.logger.logHttp(method, url, response.statusCode, duration);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `❌  ${method} ${url} failed after ${duration}ms: ${error.message}`,
            error.stack,
            'HTTP',
          );
        },
      }),
    );
  }
}
