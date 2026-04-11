import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AuditLogRepository } from 'src/repository/purchase';
import { AUDIT_LOG_QUEUE, AUDIT_LOG_JOB } from '../audit.constants';

interface AuditLogData {
  userId?: number;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    @InjectQueue(AUDIT_LOG_QUEUE) private readonly auditQueue: Queue,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  log(data: AuditLogData): void {
    this.auditQueue.add(AUDIT_LOG_JOB, data).catch((err) => {
      this.logger.error('Failed to enqueue audit log', {
        error: err?.message,
        data,
      });
    });
  }

  async getUserAuditLogs(userId: number, limit = 50) {
    return this.auditLogRepository.findUserAuditLogs(userId, limit);
  }

  async getResourceAuditLogs(resource: string, resourceId: string, limit = 50) {
    return this.auditLogRepository.findResourceAuditLogs(
      resource,
      resourceId,
      limit,
    );
  }

  async getAllAuditLogs(filters: any) {
    const maybeSkip = filters?.skip;
    const maybeTake = filters?.take;

    const skip = maybeSkip !== undefined ? Number(maybeSkip) : undefined;
    const take = maybeTake !== undefined ? Number(maybeTake) : undefined;

    const { skip: _s, take: _t, ...restFilters } = filters || {};

    return this.auditLogRepository.findMany({
      skip,
      take,
      filters: Object.keys(restFilters).length ? restFilters : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Génère un CSV des audits et l'envoie via l'objet Response
   */
  async generateAuditsCsv(filters: any): Promise<Buffer> {
    const audits = await this.getAllAuditLogs(filters);

    const header = [
      "Numéro d'identification",
      'Date de création',
      "Numéro d'identification de l'utilisateur",
      "Nom de l'utilisateur",
      "Email de l'utilisateur",
      'Action',
      'Ressource',
      "Numéro d'identification du ressource",
      'Détails',
      'Adresse IP',
      "Agent de l'utilisateur",
    ];

    const escape = (value: any) => {
      if (value === null || value === undefined) return '';
      let s = typeof value === 'string' ? value : JSON.stringify(value);
      s = s.replace(/\r?\n/g, ' ');
      if (
        s.includes('"') ||
        s.includes(',') ||
        s.includes('\n') ||
        s.includes('\r')
      ) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const rows = audits
      .map((a: any) => {
        const values = [
          a.id,
          a.createdAt?.toISOString ? a.createdAt.toISOString() : a.createdAt,
          a.user?.id ?? '',
          a.user?.name ?? '',
          a.user?.email ?? '',
          a.action ?? '',
          a.resource ?? '',
          a.resourceId ?? '',
          a.details ? JSON.stringify(a.details) : '',
          a.ipAddress ?? '',
          a.userAgent ?? '',
        ];
        return values.map(escape).join(',');
      })
      .join('\r\n');

    const csv = header.join(',') + '\r\n' + rows;

    return Buffer.from('\ufeff' + csv, 'utf8');
  }
}
