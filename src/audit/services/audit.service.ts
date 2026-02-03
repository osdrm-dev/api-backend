import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditRepository } from 'src/repository/audit/audit.repository';

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
  constructor(private readonly auditRepository: AuditRepository) {}

  async log(data: AuditLogData) {
    return this.auditRepository.log(data);
  }

  async getUserAuditLogs(userId: number, limit = 50) {
    return this.auditRepository.findUserAuditLogs(userId, limit);
  }

  async getResourceAuditLogs(resource: string, resourceId: string, limit = 50) {
    return this.auditRepository.findResourceAuditLogs(
      resource,
      resourceId,
      limit,
    );
  }

  async getAllAuditLogs(filters: any) {
    return this.auditRepository.findAllAuditLogs(filters);
  }
}
