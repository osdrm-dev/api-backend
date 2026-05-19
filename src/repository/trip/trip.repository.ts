import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma, LgTripStatus, LgTransportMode } from '@prisma/client';

export interface FindAllTripFilters {
  status?: LgTripStatus;
  transportMode?: LgTransportMode;
  requestorId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

const TRIP_INCLUDE = {
  requestor: { select: { id: true, name: true, email: true, role: true } },
  vehicle: {
    select: { id: true, immatriculation: true, marque: true, modele: true },
  },
  _count: { select: { comments: true } },
} satisfies Prisma.LgTripInclude;

const TRIP_INCLUDE_FULL = {
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
} satisfies Prisma.LgTripInclude;

@Injectable()
export class TripRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.lgTrip.findFirst({
      where: { id, deletedAt: null },
      include: TRIP_INCLUDE_FULL,
    });
  }

  async findMany(
    filters: FindAllTripFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause(filters);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lgTrip.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: TRIP_INCLUDE,
      }),
      this.prisma.lgTrip.count({ where }),
    ]);
    return { data, total };
  }

  async findManyByRequestor(
    requestorId: number,
    filters: FindAllTripFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ data: any[]; total: number }> {
    const where = this.buildWhereClause({ ...filters, requestorId });
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lgTrip.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: TRIP_INCLUDE,
      }),
      this.prisma.lgTrip.count({ where }),
    ]);
    return { data, total };
  }

  async create(data: Prisma.LgTripCreateInput) {
    return this.prisma.lgTrip.create({
      data,
      include: TRIP_INCLUDE,
    });
  }

  async updateStatus(id: string, status: LgTripStatus) {
    return this.prisma.lgTrip.update({
      where: { id },
      data: { status },
      include: TRIP_INCLUDE,
    });
  }

  async generateNextReference(year: number): Promise<string> {
    const count = await this.prisma.lgTrip.count({
      where: { reference: { startsWith: `TRJ-${year}-` } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `TRJ-${year}-${seq}`;
  }

  async countByStatus(): Promise<{
    PENDING: number;
    PROCESSED: number;
    CANCELLED: number;
  }> {
    const grouped = await this.prisma.lgTrip.groupBy({
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

  async softDelete(id: string) {
    return this.prisma.lgTrip.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private buildWhereClause(
    filters: FindAllTripFilters,
  ): Prisma.LgTripWhereInput {
    const where: Prisma.LgTripWhereInput = { deletedAt: null };

    if (filters.status) where.status = filters.status;
    if (filters.transportMode) where.transportMode = filters.transportMode;
    if (filters.requestorId) where.requestorId = filters.requestorId;

    if (filters.dateFrom || filters.dateTo) {
      where.departureDate = {};
      if (filters.dateFrom) where.departureDate.gte = filters.dateFrom;
      if (filters.dateTo) where.departureDate.lte = filters.dateTo;
    }

    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        {
          departureLocation: { contains: filters.search, mode: 'insensitive' },
        },
        { arrivalLocation: { contains: filters.search, mode: 'insensitive' } },
        { purpose: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
