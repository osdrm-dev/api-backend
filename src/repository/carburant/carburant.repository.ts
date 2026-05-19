import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma, LgCarburantStatus, LgTypeCarburant } from '@prisma/client';

export interface FindAllCarburantFilters {
  status?: LgCarburantStatus;
  typeCarburant?: LgTypeCarburant;
  vehicleId?: string;
  requestorId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

const CARBURANT_INCLUDE = {
  requestor: { select: { id: true, name: true, email: true, role: true } },
  vehicle: {
    select: { id: true, immatriculation: true, marque: true, modele: true },
  },
  _count: { select: { comments: true } },
} satisfies Prisma.LgCarburantInclude;

const CARBURANT_INCLUDE_FULL = {
  requestor: { select: { id: true, name: true, email: true, role: true } },
  vehicle: {
    select: { id: true, immatriculation: true, marque: true, modele: true },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  },
} satisfies Prisma.LgCarburantInclude;

@Injectable()
export class CarburantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.lgCarburant.findFirst({
      where: { id, deletedAt: null },
      include: CARBURANT_INCLUDE_FULL,
    });
  }

  async findMany(
    filters: FindAllCarburantFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lgCarburant.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: CARBURANT_INCLUDE,
      }),
      this.prisma.lgCarburant.count({ where }),
    ]);
    return { data, total };
  }

  async findManyByRequestor(
    requestorId: number,
    filters: FindAllCarburantFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause({ ...filters, requestorId });
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lgCarburant.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: CARBURANT_INCLUDE,
      }),
      this.prisma.lgCarburant.count({ where }),
    ]);
    return { data, total };
  }

  async create(data: Prisma.LgCarburantCreateInput) {
    return this.prisma.lgCarburant.create({
      data,
      include: CARBURANT_INCLUDE,
    });
  }

  async updateStatus(id: string, status: LgCarburantStatus) {
    return this.prisma.lgCarburant.update({
      where: { id },
      data: { status },
      include: CARBURANT_INCLUDE,
    });
  }

  async generateNextReference(year: number): Promise<string> {
    const count = await this.prisma.lgCarburant.count({
      where: { reference: { startsWith: `CAR-${year}-` } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `CAR-${year}-${seq}`;
  }

  async countByStatus(): Promise<{
    PENDING: number;
    PROCESSED: number;
    CANCELLED: number;
  }> {
    const grouped = await this.prisma.lgCarburant.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { status: true },
    });
    const result = { PENDING: 0, PROCESSED: 0, CANCELLED: 0 };
    for (const g of grouped) {
      result[g.status] = g._count.status;
    }
    return result;
  }

  async aggregateStats() {
    const [statusCounts, volumeSum, montantSum, typeCounts] = await Promise.all(
      [
        this.prisma.lgCarburant.groupBy({
          by: ['status'],
          where: { deletedAt: null },
          _count: { status: true },
        }),
        this.prisma.lgCarburant.aggregate({
          where: { deletedAt: null },
          _sum: { volumeLitres: true, montantTotal: true },
        }),
        this.prisma.lgCarburant.aggregate({
          where: { deletedAt: null },
          _sum: { montantTotal: true },
        }),
        this.prisma.lgCarburant.groupBy({
          by: ['typeCarburant'],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
      ],
    );

    const byStatus: Record<string, number> = {
      PENDING: 0,
      PROCESSED: 0,
      CANCELLED: 0,
    };
    for (const g of statusCounts) {
      byStatus[g.status] = g._count.status;
    }

    const byTypeCarburant: Record<string, number> = {};
    for (const g of typeCounts) {
      byTypeCarburant[g.typeCarburant] = g._count._all;
    }

    return {
      byStatus,
      totalVolumeLitres: volumeSum._sum.volumeLitres ?? 0,
      totalMontantMGA: montantSum._sum.montantTotal ?? 0,
      byTypeCarburant,
    };
  }

  async softDelete(id: string) {
    return this.prisma.lgCarburant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  buildWhereClause(
    filters: FindAllCarburantFilters,
  ): Prisma.LgCarburantWhereInput {
    const where: Prisma.LgCarburantWhereInput = { deletedAt: null };

    if (filters.status) where.status = filters.status;
    if (filters.typeCarburant) where.typeCarburant = filters.typeCarburant;
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.requestorId) where.requestorId = filters.requestorId;

    if (filters.dateFrom || filters.dateTo) {
      where.dateApprovisionnement = {};
      if (filters.dateFrom) where.dateApprovisionnement.gte = filters.dateFrom;
      if (filters.dateTo) where.dateApprovisionnement.lte = filters.dateTo;
    }

    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { station: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
