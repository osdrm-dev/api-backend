import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(private readonly auditService: AuditService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      const user = req['user'];

      const shouldLog = this.shouldLogRequest(req.method, req.path);

      if (shouldLog && res.statusCode < 400) {
        await this.auditService.log({
          userId: (user as any)?.id,
          action: `${req.method}_${req.path}`,
          resource: this.extractResource(req.path),
          resourceId: this.extractResourceId(req.path),
          details: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
          },
          ipAddress: this.getClientIp(req),
          userAgent: req.headers['user-agent'],
        });
      }
    });

    next();
  }

  private shouldLogRequest(method: string, path: string): boolean {
    const importantMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const excludePaths = ['/auth/refresh', '/health'];

    return (
      importantMethods.includes(method) &&
      !excludePaths.some((p) => path.includes(p))
    );
  }

  private extractResource(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts[0] || 'unknown';
  }

  private extractResourceId(path: string): string | undefined {
    const parts = path.split('/').filter(Boolean);
    if (parts[1] && /^\d+$/.test(parts[1])) {
      return parts[1];
    }
    return undefined;
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}
