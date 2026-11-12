import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AuditService } from '../../audit/services/audit.service';
import { resolveAuditEventType } from '../../audit/audit.constants';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(private readonly auditService: AuditService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const traceId = randomUUID();
    req['traceId'] = traceId;
    res.setHeader('X-Request-Id', traceId);

    if (!this.shouldLogRequest(req.method, req.path)) return next();

    // One row per request, written once it ends: by then guards have set
    // req.user and multer has parsed multipart bodies.
    res.on('close', () => {
      const { resource, resourceId } = this.extractResource(req.path);
      this.auditService.log({
        userId: (req['user'] as any)?.id,
        action: `${req.method}_${req.path}`,
        resource,
        resourceId,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: Date.now() - startTime,
          aborted: !res.writableFinished || undefined,
          traceId,
          type: resolveAuditEventType(req.method, req.path),
          body: this.sanitizeBody(req.body),
        },
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.headers['user-agent'],
      });
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

  // Ids are cuid strings or autoincrement ints. The resource is the segment
  // right before the first id: /logistique/parc-auto/vehicles/<id>/docs -> vehicles.
  private extractResource(path: string): {
    resource: string;
    resourceId?: string;
  } {
    const parts = path.split('/').filter(Boolean);
    const i = parts.findIndex((p) => /^(\d+|c[a-z0-9]{20,})$/.test(p));
    if (i > 0) return { resource: parts[i - 1], resourceId: parts[i] };
    return { resource: parts[0] || 'unknown' };
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return undefined;
    // Substring match: catches oldPassword, newPassword, refreshToken, etc.
    // shortcut: top-level keys only, recurse if nested secrets ever appear in a DTO.
    const sensitive = /password|token|secret|authorization/i;
    return Object.fromEntries(
      Object.entries(body).map(([k, v]) => [
        k,
        sensitive.test(k) ? '[REDACTED]' : v,
      ]),
    );
  }
}
