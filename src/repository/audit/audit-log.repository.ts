import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { AuditLog, Prisma } from '@prisma/client';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

/**
 * Repository pour gérer l'accès aux données AuditLog
 */
@Injectable()
export class AuditLogRepository {
  constructor(
    private prisma: PrismaService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * Include standard pour les audit logs
   */
  private readonly standardInclude: Prisma.AuditLogInclude = {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    },
  };

  /**
   * Trouve un audit log par ID
   */
  async findById(id: number): Promise<AuditLog | null> {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: this.standardInclude,
    });
  }

  /**
   * Trouve plusieurs audit logs
   */
  async findMany(params: {
    skip?: number;
    take?: number;
    filters?: {
      userId?: number;
      action?: string;
      startDate?: string;
      endDate?: string;
      resource?: string;
      resourceId?: string;
      userName?: string;
    };
    orderBy?: Prisma.AuditLogOrderByWithRelationInput;
  }): Promise<AuditLog[]> {
    const { skip, take, filters, orderBy } = params;

    const where: Prisma.AuditLogWhereInput = {
      ...(filters?.userId && { userId: filters.userId }),
      ...(filters?.action && {
        action: { contains: filters.action, mode: 'insensitive' },
      }),
      ...(filters?.resource && { resource: filters.resource }),
      ...(filters?.resourceId && { resourceId: filters.resourceId }),
      ...(filters?.userName && {
        user: { name: { contains: filters.userName, mode: 'insensitive' } },
      }),
      ...((filters?.startDate || filters?.endDate) && {
        createdAt: {
          ...(filters?.startDate && { gte: new Date(filters.startDate) }),
          ...(filters?.endDate && { lte: new Date(filters.endDate) }),
        },
      }),
    };

    return this.prisma.auditLog.findMany({
      skip,
      take,
      where,
      orderBy,
      include: this.standardInclude,
    });
  }

  /**
   * Crée un audit log
   */
  async create(data: Prisma.AuditLogCreateInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data,
      include: this.standardInclude,
    });
  }

  /**
   * Compte les audit logs
   */
  async count(where?: Prisma.AuditLogWhereInput): Promise<number> {
    return this.prisma.auditLog.count({ where });
  }

  /**
   * Trouve les logs par utilisateur
   */
  async findByUser(params: {
    userId: number;
    skip?: number;
    take?: number;
  }): Promise<AuditLog[]> {
    const { userId, skip, take } = params;

    return this.findMany({
      skip,
      take,
      filters: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Trouve les logs par action
   */
  async findByAction(params: {
    action: string;
    skip?: number;
    take?: number;
  }): Promise<AuditLog[]> {
    const { action, skip, take } = params;

    return this.findMany({
      skip,
      take,
      filters: { action },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Trouve les logs par ressource
   */
  async findByResource(params: {
    resource: string;
    resourceId?: string;
    skip?: number;
    take?: number;
  }): Promise<AuditLog[]> {
    const { resource, resourceId, skip, take } = params;

    // const where: Prisma.AuditLogWhereInput = { resource };
    // if (resourceId) {
    //   where.resourceId = resourceId;
    // }

    return this.findMany({
      skip,
      take,
      filters: { resource, resourceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Trouve les logs dans une plage de dates
   */
  async findByDateRange(params: {
    startDate: Date;
    endDate: Date;
    skip?: number;
    take?: number;
  }): Promise<AuditLog[]> {
    const { startDate, endDate, skip, take } = params;

    return this.findMany({
      skip,
      take,
      filters: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Crée un log de validation
   */
  async createValidationLog(params: {
    userId: number;
    action: string;
    purchaseId: string;
    details: any;
  }): Promise<AuditLog> {
    const { userId, action, purchaseId, details } = params;

    return this.create({
      user: { connect: { id: userId } },
      action,
      resource: 'PURCHASE',
      resourceId: purchaseId,
      details,
    });
  }

  /**
   * Récupère les dernières activités
   */
  async getRecentActivity(params: {
    limit?: number;
    userId?: number;
  }): Promise<AuditLog[]> {
    const { limit = 50, userId } = params;

    return this.findMany({
      take: limit,
      filters: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Compte les actions par type
   */
  async countByAction(action: string): Promise<number> {
    return this.count({ action });
  }

  /**
   * Trouve les logs d'une purchase spécifique
   */
  async findPurchaseLogs(purchaseId: string): Promise<AuditLog[]> {
    return this.findMany({
      filters: {
        resource: 'PURCHASE',
        resourceId: purchaseId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // method by Kevin
  async log(data: any) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          details: data.details,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create audit log', {
        error: error.message,
        data,
      });
      // Ne pas faire échouer l'opération principale si l'audit échoue
    }
  }

  async findUserAuditLogs(userId: number, limit: number) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findResourceAuditLogs(
    resource: string,
    resourceId: string,
    limit: number,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        resource,
        resourceId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
