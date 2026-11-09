import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { EquipmentDemandStatus, Prisma } from '@prisma/client';

export interface EquipmentDemandFilters {
  requestorId?: number;
  status?: EquipmentDemandStatus;
  categoryId?: string;
}

export interface EquipmentDemandPagination {
  skip: number;
  take: number;
}

@Injectable()
export class EquipmentDemandRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly standardInclude: Prisma.EquipmentDemandInclude = {
    requestor: { select: { id: true, name: true, email: true, role: true } },
    category: true,
    linkedPurchase: { select: { id: true, reference: true, status: true } },
    files: {
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        url: true,
      },
    },
  };

  async create(data: {
    reference: string;
    requestorId: number;
    categoryId?: string;
    desiredType: string;
    quantity: number;
    justification: string;
    fileIds: number[];
  }) {
    const { fileIds, ...rest } = data;
    return this.prisma.equipmentDemand.create({
      data: {
        ...rest,
        files: { connect: fileIds.map((id) => ({ id })) },
      },
      include: this.standardInclude,
    });
  }

  countFilesUploadedBy(fileIds: number[], userId: number) {
    return this.prisma.file.count({
      where: { id: { in: fileIds }, uploadedById: userId },
    });
  }

  async findById(id: string) {
    return this.prisma.equipmentDemand.findUnique({
      where: { id },
      include: this.standardInclude,
    });
  }

  async findAll(
    filters: EquipmentDemandFilters,
    pagination: EquipmentDemandPagination,
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.equipmentDemand.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.standardInclude,
      }),
      this.prisma.equipmentDemand.count({ where }),
    ]);

    return { data, total };
  }

  async findAllForRequestor(
    requestorId: number,
    filters: EquipmentDemandFilters,
    pagination: EquipmentDemandPagination,
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);
    where.requestorId = requestorId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.equipmentDemand.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.standardInclude,
      }),
      this.prisma.equipmentDemand.count({ where }),
    ]);

    return { data, total };
  }

  async updateStatus(
    id: string,
    status: EquipmentDemandStatus,
    adminNote?: string,
  ) {
    const data: Prisma.EquipmentDemandUpdateInput = { status };
    if (adminNote !== undefined) {
      data.adminNote = adminNote;
    }
    return this.prisma.equipmentDemand.update({
      where: { id },
      data,
      include: this.standardInclude,
    });
  }

  async linkPurchase(id: string, purchaseId: string) {
    return this.prisma.equipmentDemand.update({
      where: { id },
      data: { linkedPurchaseId: purchaseId },
      include: this.standardInclude,
    });
  }

  async generateReference(year: number): Promise<string> {
    const prefix = `ITD-${year}-`;
    const latest = await this.prisma.equipmentDemand.findFirst({
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
  }

  private buildWhereClause(
    filters: EquipmentDemandFilters,
  ): Prisma.EquipmentDemandWhereInput {
    const where: Prisma.EquipmentDemandWhereInput = {};

    if (filters.requestorId) {
      where.requestorId = filters.requestorId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    return where;
  }
}
