import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private store: RateLimitStore = {};
  private readonly limit = 100; // Nombre de requêtes
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes

  use(req: Request, res: Response, next: NextFunction) {
    const key = this.getKey(req);
    const now = Date.now();

    // Nettoyer les entrées expirées
    if (this.store[key] && this.store[key].resetTime < now) {
      delete this.store[key];
    }

    // Initialiser ou incrémenter le compteur
    if (!this.store[key]) {
      this.store[key] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
    } else {
      this.store[key].count++;
    }

    const { count, resetTime } = this.store[key];

    res.setHeader('X-RateLimit-Limit', this.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.limit - count));
    res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());

    // Vérifier si la limite est dépassée
    if (count > this.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil((resetTime - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }

  private getKey(req: Request): string {
    const user = req['user'];
    const ip = this.getClientIp(req);

    return (user as any)?.id ? `user:${(user as any).id}` : `ip:${ip}`;
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}
