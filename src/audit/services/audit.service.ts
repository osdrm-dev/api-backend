import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogRepository } from 'src/repository/purchase';

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
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async log(data: AuditLogData) {
    return this.auditLogRepository.log(data);
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
    return this.auditLogRepository.findMany({
      filters,
    });
  }
}
