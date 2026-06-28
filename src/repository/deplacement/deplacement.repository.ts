import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  Prisma,
  LgDeplacement,
  LgDeplacementStatus,
  LgTypeMission,
} from '@prisma/client';

export interface FindAllDeplacementFilters {
  status?: LgDeplacementStatus;
  typeMission?: LgTypeMission;
  requestorId?: number;
  vehicleId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

const DEPLACEMENT_INCLUDE = {
  requestor: { select: { id: true, name: true, email: true } },
  gestionnaire: { select: { id: true, name: true, email: true } },
  vehicle: {
    select: { id: true, immatriculation: true, marque: true, modele: true },
  },
  liquidation: {
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
} satisfies Prisma.LgDeplacementInclude;

const DEPLACEMENT_INCLUDE_FULL = {
  ...DEPLACEMENT_INCLUDE,
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.LgDeplacementInclude;

@Injectable()
export class DeplacementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.lgDeplacement.findFirst({
      where: { id, deletedAt: null },
      include: DEPLACEMENT_INCLUDE_FULL,
    });
  }

  async findMany(
    filters: FindAllDeplacementFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ data: LgDeplacement[]; total: number }> {
    const where = this.buildWhereClause(filters);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lgDeplacement.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: DEPLACEMENT_INCLUDE,
      }),
      this.prisma.lgDeplacement.count({ where }),
    ]);
    return { data, total };
  }

  async findManyByRequestor(
    requestorId: number,
    pagination: { skip: number; take: number },
  ): Promise<{ data: LgDeplacement[]; total: number }> {
    const where: Prisma.LgDeplacementWhereInput = {
      requestorId,
      deletedAt: null,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lgDeplacement.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: DEPLACEMENT_INCLUDE,
      }),
      this.prisma.lgDeplacement.count({ where }),
    ]);
    return { data, total };
  }

  async create(data: Prisma.LgDeplacementCreateInput) {
    return this.prisma.lgDeplacement.create({
      data,
      include: DEPLACEMENT_INCLUDE,
    });
  }

  async updateStatus(
    id: string,
    status: LgDeplacementStatus,
    extra?: Prisma.LgDeplacementUpdateInput,
  ) {
    return this.prisma.lgDeplacement.update({
      where: { id },
      data: { status, ...extra },
      include: DEPLACEMENT_INCLUDE,
    });
  }

  async assignVehicle(id: string, vehicleId: string, gestionnaireId: number) {
    return this.prisma.lgDeplacement.update({
      where: { id },
      data: {
        vehicleId,
        gestionnairId: gestionnaireId,
        status: LgDeplacementStatus.VEHICULE_ATTRIBUE,
      },
      include: DEPLACEMENT_INCLUDE,
    });
  }

  async confirm(
    id: string,
    gestionnaireId: number,
    montantPerDiem: Prisma.Decimal,
    instructionsComplementaires?: string,
  ) {
    return this.prisma.lgDeplacement.update({
      where: { id },
      data: {
        status: LgDeplacementStatus.CONFIRMEE,
        gestionnairId: gestionnaireId,
        montantPerDiem,
        instructionsComplementaires,
        confirmedAt: new Date(),
      },
      include: DEPLACEMENT_INCLUDE_FULL,
    });
  }

  async setLinkedPurchase(id: string, linkedPurchaseId: string) {
    return this.prisma.lgDeplacement.update({
      where: { id },
      data: {
        linkedPurchaseId,
        status: LgDeplacementStatus.EN_ATTENTE_LOCATION,
      },
      include: DEPLACEMENT_INCLUDE,
    });
  }

  async softDelete(id: string) {
    return this.prisma.lgDeplacement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findVehicleConflict(
    vehicleId: string,
    dateDepart: Date,
    dateRetour: Date,
    excludeId?: string,
  ): Promise<LgDeplacement | null> {
    return this.prisma.lgDeplacement.findFirst({
      where: {
        vehicleId,
        deletedAt: null,
        status: {
          in: [
            LgDeplacementStatus.VEHICULE_ATTRIBUE,
            LgDeplacementStatus.CONFIRMEE,
            LgDeplacementStatus.EN_COURS,
          ],
        },
        AND: [
          { dateDepart: { lt: dateRetour } },
          { dateRetour: { gt: dateDepart } },
        ],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async generateNextReference(year: number): Promise<string> {
    const count = await this.prisma.lgDeplacement.count({
      where: { reference: { startsWith: `DEP-${year}-` } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `DEP-${year}-${seq}`;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const grouped = await this.prisma.lgDeplacement.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { status: true },
    });
    return Object.fromEntries(grouped.map((g) => [g.status, g._count.status]));
  }

  private buildWhereClause(
    filters: FindAllDeplacementFilters,
  ): Prisma.LgDeplacementWhereInput {
    const where: Prisma.LgDeplacementWhereInput = { deletedAt: null };

    if (filters.status) where.status = filters.status;
    if (filters.typeMission) where.typeMission = filters.typeMission;
    if (filters.requestorId) where.requestorId = filters.requestorId;
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;

    if (filters.dateFrom || filters.dateTo) {
      where.dateDepart = {};
      if (filters.dateFrom) where.dateDepart.gte = filters.dateFrom;
      if (filters.dateTo) where.dateDepart.lte = filters.dateTo;
    }

    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { objet: { contains: filters.search, mode: 'insensitive' } },
        { destination: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
