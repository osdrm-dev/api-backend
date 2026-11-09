import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { EquipmentStatus, Prisma } from '@prisma/client';

export interface EquipmentFilters {
  categoryId?: string;
  status?: EquipmentStatus;
  location?: string;
  search?: string;
  includeArchived?: boolean;
}

export interface EquipmentPagination {
  skip: number;
  take: number;
}

@Injectable()
export class EquipmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly standardInclude: Prisma.EquipmentInclude = {
    category: true,
    attributions: { where: { status: 'ACTIVE' } },
  };

  /** Crée plusieurs matériels en une transaction (tout ou rien). */
  async createMany(rows: Prisma.EquipmentUncheckedCreateInput[]) {
    return this.prisma.$transaction(
      rows.map((data) =>
        this.prisma.equipment.create({ data, include: this.standardInclude }),
      ),
    );
  }

  async findById(id: string) {
    return this.prisma.equipment.findUnique({
      where: { id },
      include: {
        ...this.standardInclude,
        attributions: {
          where: { status: 'ACTIVE' },
          include: { beneficiary: { select: { id: true, name: true } } },
        },
        // Historique des réparations (fiche matériel).
        maintenanceRequests: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reference: true,
            title: true,
            status: true,
            urgencyLevel: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });
  }

  async findAll(
    filters: EquipmentFilters,
    pagination: EquipmentPagination,
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.equipment.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.standardInclude,
      }),
      this.prisma.equipment.count({ where }),
    ]);

    return { data, total };
  }

  async update(id: string, data: Prisma.EquipmentUncheckedUpdateInput) {
    return this.prisma.equipment.update({
      where: { id },
      data,
      include: this.standardInclude,
    });
  }

  async archive(id: string) {
    return this.prisma.equipment.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: this.standardInclude,
    });
  }

  async linkPurchase(id: string, purchaseId: string) {
    return this.prisma.equipment.update({
      where: { id },
      data: { linkedPurchaseId: purchaseId },
      include: this.standardInclude,
    });
  }

  private buildWhereClause(
    filters: EquipmentFilters,
  ): Prisma.EquipmentWhereInput {
    const where: Prisma.EquipmentWhereInput = {};

    if (!filters.includeArchived) {
      where.archivedAt = null;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }

    if (filters.search) {
      where.OR = [
        { designation: { contains: filters.search, mode: 'insensitive' } },
        { serialNumber: { contains: filters.search, mode: 'insensitive' } },
        {
          inventoryReference: { contains: filters.search, mode: 'insensitive' },
        },
        { brand: { contains: filters.search, mode: 'insensitive' } },
        { model: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
