import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ItAssetStatus, Prisma } from '@prisma/client';

export interface ItAssetFilters {
  categoryId?: string;
  status?: ItAssetStatus;
  location?: string;
  search?: string;
  includeArchived?: boolean;
}

export interface ItAssetPagination {
  skip: number;
  take: number;
}

@Injectable()
export class ItAssetRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly standardInclude: Prisma.ItAssetInclude = {
    category: true,
    attributions: { where: { status: 'ACTIVE' } },
  };

  async create(data: {
    categoryId: string;
    designation: string;
    serialNumber?: string;
    supplierReference?: string;
    status?: ItAssetStatus;
    location?: string;
    acquisitionDate: Date;
    purchasePrice: number;
    quantiteTotal?: number;
    seuilAlerte?: number;
    depreciationOverrideYears?: number;
  }) {
    return this.prisma.itAsset.create({
      data,
      include: this.standardInclude,
    });
  }

  async findById(id: string) {
    return this.prisma.itAsset.findUnique({
      where: { id },
      include: this.standardInclude,
    });
  }

  async findAll(
    filters: ItAssetFilters,
    pagination: ItAssetPagination,
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.itAsset.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.standardInclude,
      }),
      this.prisma.itAsset.count({ where }),
    ]);

    return { data, total };
  }

  async update(
    id: string,
    data: {
      categoryId?: string;
      designation?: string;
      serialNumber?: string;
      supplierReference?: string;
      status?: ItAssetStatus;
      location?: string;
      acquisitionDate?: Date;
      purchasePrice?: number;
      quantiteTotal?: number;
      seuilAlerte?: number;
      depreciationOverrideYears?: number;
    },
  ) {
    return this.prisma.itAsset.update({
      where: { id },
      data,
      include: this.standardInclude,
    });
  }

  async archive(id: string) {
    return this.prisma.itAsset.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: this.standardInclude,
    });
  }

  async linkPurchase(id: string, purchaseId: string) {
    return this.prisma.itAsset.update({
      where: { id },
      data: { linkedPurchaseId: purchaseId },
      include: this.standardInclude,
    });
  }

  async incrementAttribuee(id: string, quantity: number, tx?: any) {
    const client = tx ?? this.prisma;
    return client.itAsset.update({
      where: { id },
      data: { quantiteAttribuee: { increment: quantity } },
    });
  }

  async decrementAttribuee(id: string, quantity: number, tx?: any) {
    const client = tx ?? this.prisma;
    return client.itAsset.update({
      where: { id },
      data: { quantiteAttribuee: { decrement: quantity } },
    });
  }

  private buildWhereClause(filters: ItAssetFilters): Prisma.ItAssetWhereInput {
    const where: Prisma.ItAssetWhereInput = {};

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
      ];
    }

    return where;
  }
}
