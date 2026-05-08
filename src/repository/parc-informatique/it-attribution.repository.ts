import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ItAssetStatus, ItAttributionStatus, Prisma } from '@prisma/client';

export interface ItAttributionFilters {
  assetId?: string;
  beneficiaryId?: number;
  status?: ItAttributionStatus;
  demandId?: string;
}

export interface ItAttributionPagination {
  skip: number;
  take: number;
}

@Injectable()
export class ItAttributionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly standardInclude: Prisma.ItAttributionInclude = {
    asset: { include: { category: true } },
    beneficiary: { select: { id: true, name: true, email: true, role: true } },
    demand: true,
  };

  async create(data: {
    assetId: string;
    beneficiaryId: number;
    quantity: number;
    attributedAt?: Date;
    notes?: string;
    demandId?: string;
  }) {
    return this.prisma.itAttribution.create({
      data,
      include: this.standardInclude,
    });
  }

  async findById(id: string) {
    return this.prisma.itAttribution.findUnique({
      where: { id },
      include: this.standardInclude,
    });
  }

  async findAll(
    filters: ItAttributionFilters,
    pagination: ItAttributionPagination,
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.itAttribution.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.standardInclude,
      }),
      this.prisma.itAttribution.count({ where }),
    ]);

    return { data, total };
  }

  async return(
    id: string,
    returnedAt: Date,
    returnCondition?: ItAssetStatus,
    notes?: string,
  ) {
    const data: Prisma.ItAttributionUpdateInput = {
      status: ItAttributionStatus.RETOURNE,
      returnedAt,
    };
    if (returnCondition !== undefined) {
      data.returnCondition = returnCondition;
    }
    if (notes !== undefined) {
      data.notes = notes;
    }
    return this.prisma.itAttribution.update({
      where: { id },
      data,
      include: this.standardInclude,
    });
  }

  private buildWhereClause(
    filters: ItAttributionFilters,
  ): Prisma.ItAttributionWhereInput {
    const where: Prisma.ItAttributionWhereInput = {};

    if (filters.assetId) {
      where.assetId = filters.assetId;
    }

    if (filters.beneficiaryId) {
      where.beneficiaryId = filters.beneficiaryId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.demandId) {
      where.demandId = filters.demandId;
    }

    return where;
  }
}
