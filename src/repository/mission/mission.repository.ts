import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  Prisma,
  LgMission,
  LgMissionStatus,
  LgMissionType,
} from '@prisma/client';

export interface FindAllMissionFilters {
  status?: LgMissionStatus;
  missionType?: LgMissionType;
  requestorId?: number;
  vehicleId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

const MISSION_INCLUDE = {
  requestor: { select: { id: true, name: true, email: true } },
  manager: { select: { id: true, name: true, email: true } },
  vehicle: {
    select: { id: true, immatriculation: true, marque: true, modele: true },
  },
  settlement: {
    include: {
      validations: {
        orderBy: { role: 'asc' as const },
        include: {
          validator: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
    },
  },
  _count: { select: { comments: true } },
} satisfies Prisma.LgMissionInclude;

const MISSION_INCLUDE_FULL = {
  ...MISSION_INCLUDE,
  trips: {
    where: { deletedAt: null },
    select: { id: true, reference: true, status: true, departureDate: true },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.LgMissionInclude;

@Injectable()
export class MissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.lgMission.findFirst({
      where: { id, deletedAt: null },
      include: MISSION_INCLUDE_FULL,
    });
  }

  async findMany(
    filters: FindAllMissionFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ data: LgMission[]; total: number }> {
    const where = this.buildWhereClause(filters);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lgMission.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: MISSION_INCLUDE,
      }),
      this.prisma.lgMission.count({ where }),
    ]);
    return { data, total };
  }

  async findManyByRequestor(
    requestorId: number,
    pagination: { skip: number; take: number },
  ): Promise<{ data: LgMission[]; total: number }> {
    const where: Prisma.LgMissionWhereInput = {
      requestorId,
      deletedAt: null,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lgMission.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: MISSION_INCLUDE,
      }),
      this.prisma.lgMission.count({ where }),
    ]);
    return { data, total };
  }

  async create(data: Prisma.LgMissionCreateInput) {
    return this.prisma.lgMission.create({
      data,
      include: MISSION_INCLUDE,
    });
  }

  async updateStatus(
    id: string,
    status: LgMissionStatus,
    extra?: Prisma.LgMissionUpdateInput,
  ) {
    return this.prisma.lgMission.update({
      where: { id },
      data: { status, ...extra },
      include: MISSION_INCLUDE,
    });
  }

  async assignVehicle(id: string, vehicleId: string, managerId: number) {
    return this.prisma.lgMission.update({
      where: { id },
      data: {
        vehicleId,
        managerId: managerId,
        status: LgMissionStatus.VEHICLE_ASSIGNED,
      },
      include: MISSION_INCLUDE,
    });
  }

  async confirm(
    id: string,
    managerId: number,
    perDiemAmount: Prisma.Decimal,
    additionalInstructions?: string,
  ) {
    return this.prisma.lgMission.update({
      where: { id },
      data: {
        status: LgMissionStatus.CONFIRMED,
        managerId: managerId,
        perDiemAmount,
        additionalInstructions,
        confirmedAt: new Date(),
      },
      include: MISSION_INCLUDE_FULL,
    });
  }

  async setLinkedPurchase(id: string, linkedPurchaseId: string) {
    return this.prisma.lgMission.update({
      where: { id },
      data: {
        linkedPurchaseId,
        status: LgMissionStatus.PENDING_RENTAL,
      },
      include: MISSION_INCLUDE,
    });
  }

  async softDelete(id: string) {
    return this.prisma.lgMission.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findVehicleConflict(
    vehicleId: string,
    departureDate: Date,
    returnDate: Date,
    excludeId?: string,
  ): Promise<LgMission | null> {
    return this.prisma.lgMission.findFirst({
      where: {
        vehicleId,
        deletedAt: null,
        status: {
          in: [
            LgMissionStatus.VEHICLE_ASSIGNED,
            LgMissionStatus.CONFIRMED,
            LgMissionStatus.IN_PROGRESS,
          ],
        },
        AND: [
          { departureDate: { lt: returnDate } },
          { returnDate: { gt: departureDate } },
        ],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async generateNextReference(year: number): Promise<string> {
    const count = await this.prisma.lgMission.count({
      where: { reference: { startsWith: `TRJ-${year}-` } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `TRJ-${year}-${seq}`;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const grouped = await this.prisma.lgMission.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { status: true },
    });
    return Object.fromEntries(grouped.map((g) => [g.status, g._count.status]));
  }

  private buildWhereClause(
    filters: FindAllMissionFilters,
  ): Prisma.LgMissionWhereInput {
    const where: Prisma.LgMissionWhereInput = { deletedAt: null };

    if (filters.status) where.status = filters.status;
    if (filters.missionType) where.missionType = filters.missionType;
    if (filters.requestorId) where.requestorId = filters.requestorId;
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;

    if (filters.dateFrom || filters.dateTo) {
      where.departureDate = {};
      if (filters.dateFrom) where.departureDate.gte = filters.dateFrom;
      if (filters.dateTo) where.departureDate.lte = filters.dateTo;
    }

    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { purpose: { contains: filters.search, mode: 'insensitive' } },
        { destination: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
