import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  EquipmentStatus,
  EquipmentAttributionStatus,
  Prisma,
} from '@prisma/client';

export interface EquipmentAttributionFilters {
  assetId?: string;
  beneficiaryId?: number;
  status?: EquipmentAttributionStatus;
  demandId?: string;
}

export interface EquipmentAttributionPagination {
  skip: number;
  take: number;
}

@Injectable()
export class EquipmentAttributionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly standardInclude: Prisma.EquipmentAttributionInclude = {
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
    return this.prisma.equipmentAttribution.create({
      data,
      include: this.standardInclude,
    });
  }

  async findById(id: string) {
    return this.prisma.equipmentAttribution.findUnique({
      where: { id },
      include: this.standardInclude,
    });
  }

  async findAll(
    filters: EquipmentAttributionFilters,
    pagination: EquipmentAttributionPagination,
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.equipmentAttribution.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.standardInclude,
      }),
      this.prisma.equipmentAttribution.count({ where }),
    ]);

    return { data, total };
  }

  /** Toutes les attributions actives, filtrées sur le nom/email du détenteur. */
  // shortcut: pas de pagination (une ligne par matériel attribué), à paginer côté DB si le parc dépasse quelques milliers d'unités.
  async findActiveForHolders(search?: string) {
    return this.prisma.equipmentAttribution.findMany({
      where: {
        status: EquipmentAttributionStatus.ACTIVE,
        ...(search && {
          beneficiary: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        }),
      },
      orderBy: { attributedAt: 'desc' },
      include: {
        asset: { include: { category: true } },
        beneficiary: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async return(
    id: string,
    returnedAt: Date,
    returnCondition?: EquipmentStatus,
    notes?: string,
  ) {
    const data: Prisma.EquipmentAttributionUpdateInput = {
      status: EquipmentAttributionStatus.RETOURNE,
      returnedAt,
    };
    if (returnCondition !== undefined) {
      data.returnCondition = returnCondition;
    }
    if (notes !== undefined) {
      data.notes = notes;
    }
    return this.prisma.equipmentAttribution.update({
      where: { id },
      data,
      include: this.standardInclude,
    });
  }

  private buildWhereClause(
    filters: EquipmentAttributionFilters,
  ): Prisma.EquipmentAttributionWhereInput {
    const where: Prisma.EquipmentAttributionWhereInput = {};

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
