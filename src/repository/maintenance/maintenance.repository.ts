import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  MaintenanceStatus,
  MaintenanceInterventionType,
  MaintenanceUrgencyLevel,
  Prisma,
} from '@prisma/client';

export interface MaintenanceFilters {
  status?: MaintenanceStatus;
  urgencyLevel?: MaintenanceUrgencyLevel;
  interventionType?: MaintenanceInterventionType;
  vehicleRef?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface MaintenancePagination {
  skip: number;
  take: number;
}

@Injectable()
export class MaintenanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly standardInclude: Prisma.MaintenanceRequestInclude = {
    requestor: {
      select: { id: true, name: true, email: true },
    },
    assignedTo: {
      select: { id: true, name: true, email: true },
    },
    linkedPurchase: {
      select: { id: true, reference: true, status: true },
    },
    _count: {
      select: { comments: true },
    },
  };

  async create(data: {
    reference: string;
    interventionType: MaintenanceInterventionType;
    urgencyLevel?: MaintenanceUrgencyLevel;
    title: string;
    description: string;
    location?: string;
    vehicleRef?: string;
    requestorId?: number;
  }) {
    return this.prisma.maintenanceRequest.create({
      data,
      include: this.standardInclude,
    });
  }

  async findById(id: string) {
    return this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: this.standardInclude,
    });
  }

  async findAllAdmin(
    filters: MaintenanceFilters,
    pagination: MaintenancePagination,
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.standardInclude,
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    return { data, total };
  }

  async findAllForRequestor(
    requestorId: number,
    filters: MaintenanceFilters,
    pagination: MaintenancePagination,
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);
    where.requestorId = requestorId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.standardInclude,
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    return { data, total };
  }

  async findStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [byStatus, byUrgency, byType, thisMonthCount, resolvedRequests] =
      await Promise.all([
        this.prisma.maintenanceRequest.groupBy({
          by: ['status'],
          where: { deletedAt: null },
          _count: { id: true },
        }),
        this.prisma.maintenanceRequest.groupBy({
          by: ['urgencyLevel'],
          where: { deletedAt: null },
          _count: { id: true },
        }),
        this.prisma.maintenanceRequest.groupBy({
          by: ['interventionType'],
          where: { deletedAt: null },
          _count: { id: true },
        }),
        this.prisma.maintenanceRequest.count({
          where: { deletedAt: null, createdAt: { gte: startOfMonth } },
        }),
        this.prisma.maintenanceRequest.findMany({
          where: {
            deletedAt: null,
            status: MaintenanceStatus.VALIDATED,
            completedAt: { not: null },
          },
          select: { createdAt: true, completedAt: true },
        }),
      ]);

    const totalResolved = resolvedRequests.length;
    let avgResolutionDays = 0;
    if (totalResolved > 0) {
      const totalDays = resolvedRequests.reduce((sum, r) => {
        const diff =
          (r.completedAt!.getTime() - r.createdAt.getTime()) /
          (1000 * 60 * 60 * 24);
        return sum + diff;
      }, 0);
      avgResolutionDays = Math.round((totalDays / totalResolved) * 10) / 10;
    }

    return {
      byStatus: Object.fromEntries(
        byStatus.map((s) => [s.status, s._count.id]),
      ),
      byUrgency: Object.fromEntries(
        byUrgency.map((u) => [u.urgencyLevel, u._count.id]),
      ),
      byType: Object.fromEntries(
        byType.map((t) => [t.interventionType, t._count.id]),
      ),
      thisMonthCount,
      avgResolutionDays,
    };
  }

  async updateStatus(
    id: string,
    status: MaintenanceStatus,
    adminUserId?: number,
    observations?: string,
  ) {
    const data: Prisma.MaintenanceRequestUpdateInput = { status };

    if (adminUserId !== undefined) {
      data.assignedTo = { connect: { id: adminUserId } };
    }

    if (observations !== undefined) {
      data.observations = observations;
    }

    if (status === MaintenanceStatus.VALIDATED) {
      data.completedAt = new Date();
    }

    return this.prisma.maintenanceRequest.update({
      where: { id },
      data,
      include: this.standardInclude,
    });
  }

  async linkPurchase(id: string, purchaseId: string) {
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: { linkedPurchaseId: purchaseId },
      include: this.standardInclude,
    });
  }

  async softDelete(id: string) {
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      urgencyLevel?: MaintenanceUrgencyLevel;
      location?: string;
      vehicleRef?: string;
    },
  ) {
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data,
      include: this.standardInclude,
    });
  }

  async generateReference(year: number): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const prefix = `ENT-${year}-`;
      const latest = await tx.maintenanceRequest.findFirst({
        where: { reference: { startsWith: prefix } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
      });

      let nextNumber = 1;
      if (latest) {
        const parts = latest.reference.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1;
        }
      }

      return `${prefix}${String(nextNumber).padStart(4, '0')}`;
    });
  }

  private buildWhereClause(
    filters: MaintenanceFilters,
  ): Prisma.MaintenanceRequestWhereInput {
    const where: Prisma.MaintenanceRequestWhereInput = {
      deletedAt: null,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.urgencyLevel) {
      where.urgencyLevel = filters.urgencyLevel;
    }

    if (filters.interventionType) {
      where.interventionType = filters.interventionType;
    }

    if (filters.vehicleRef) {
      where.vehicleRef = { contains: filters.vehicleRef, mode: 'insensitive' };
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { reference: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    return where;
  }
}
