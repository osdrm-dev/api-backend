import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ItDemandStatus, Prisma } from '@prisma/client';

export interface ItDemandFilters {
  requestorId?: number;
  status?: ItDemandStatus;
  categoryId?: string;
}

export interface ItDemandPagination {
  skip: number;
  take: number;
}

@Injectable()
export class ItDemandRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly standardInclude: Prisma.ItDemandInclude = {
    requestor: { select: { id: true, name: true, email: true, role: true } },
    category: true,
    linkedPurchase: { select: { id: true, reference: true, status: true } },
  };

  async create(data: {
    reference: string;
    requestorId: number;
    categoryId?: string;
    desiredType: string;
    quantity: number;
    justification: string;
  }) {
    return this.prisma.itDemand.create({
      data,
      include: this.standardInclude,
    });
  }

  async findById(id: string) {
    return this.prisma.itDemand.findUnique({
      where: { id },
      include: this.standardInclude,
    });
  }

  async findAll(
    filters: ItDemandFilters,
    pagination: ItDemandPagination,
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.itDemand.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.standardInclude,
      }),
      this.prisma.itDemand.count({ where }),
    ]);

    return { data, total };
  }

  async findAllForRequestor(
    requestorId: number,
    filters: ItDemandFilters,
    pagination: ItDemandPagination,
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);
    where.requestorId = requestorId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.itDemand.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.standardInclude,
      }),
      this.prisma.itDemand.count({ where }),
    ]);

    return { data, total };
  }

  async updateStatus(id: string, status: ItDemandStatus, adminNote?: string) {
    const data: Prisma.ItDemandUpdateInput = { status };
    if (adminNote !== undefined) {
      data.adminNote = adminNote;
    }
    return this.prisma.itDemand.update({
      where: { id },
      data,
      include: this.standardInclude,
    });
  }

  async linkPurchase(id: string, purchaseId: string) {
    return this.prisma.itDemand.update({
      where: { id },
      data: { linkedPurchaseId: purchaseId },
      include: this.standardInclude,
    });
  }

  async generateReference(year: number): Promise<string> {
    const prefix = `ITD-${year}-`;
    const latest = await this.prisma.itDemand.findFirst({
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
    filters: ItDemandFilters,
  ): Prisma.ItDemandWhereInput {
    const where: Prisma.ItDemandWhereInput = {};

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
