import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  Prisma,
  LgBailContract,
  LgBailAvenant,
  LgBailPaiement,
  LgBailStatut,
  LgBailType,
} from '@prisma/client';

export type BailContractWithRelations = LgBailContract & {
  avenants: LgBailAvenant[];
  paiements: LgBailPaiement[];
  contratFile: { id: number; url: string; originalName: string } | null;
};

export interface FindAllBailFilters {
  statut?: LgBailStatut;
  type?: LgBailType;
  site?: string;
  search?: string;
  includeArchived?: boolean;
}

@Injectable()
export class BauxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    filters: FindAllBailFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ data: LgBailContract[]; total: number }> {
    const where = this.buildWhereClause(filters);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lgBailContract.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          contratFile: { select: { id: true, url: true, originalName: true } },
          _count: { select: { avenants: true, paiements: true } },
        },
      }),
      this.prisma.lgBailContract.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string): Promise<BailContractWithRelations | null> {
    return this.prisma.lgBailContract.findUnique({
      where: { id },
      include: {
        contratFile: { select: { id: true, url: true, originalName: true } },
        avenants: {
          orderBy: { createdAt: 'desc' },
          include: {
            file: { select: { id: true, url: true, originalName: true } },
          },
        },
        paiements: { orderBy: { datePaiement: 'desc' } },
      },
    }) as Promise<BailContractWithRelations | null>;
  }

  async create(
    data: Prisma.LgBailContractCreateInput,
  ): Promise<LgBailContract> {
    return this.prisma.lgBailContract.create({ data });
  }

  async update(
    id: string,
    data: Prisma.LgBailContractUpdateInput,
  ): Promise<LgBailContract> {
    return this.prisma.lgBailContract.update({ where: { id }, data });
  }

  async generateNextReference(year: number): Promise<string> {
    const count = await this.prisma.lgBailContract.count({
      where: { reference: { startsWith: `BAX-${year}-` } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `BAX-${year}-${seq}`;
  }

  async findExpiringContracts(
    thresholdDays: number,
    currentYear: number,
  ): Promise<LgBailContract[]> {
    const now = new Date();
    const target = new Date(
      now.getTime() + thresholdDays * 24 * 60 * 60 * 1000,
    );

    return this.prisma.lgBailContract.findMany({
      where: {
        statut: LgBailStatut.ACTIF,
        dateFin: { gte: now, lte: target },
        alertLogs: {
          none: { thresholdDays, annee: currentYear },
        },
      },
    });
  }

  async findContractsForIndexation(
    currentMonth: number,
  ): Promise<LgBailContract[]> {
    return this.prisma.lgBailContract.findMany({
      where: {
        statut: LgBailStatut.ACTIF,
        indexationMois: currentMonth,
        indexationRate: { gt: 0 },
      },
    });
  }

  async createAlertLog(
    contractId: string,
    thresholdDays: number,
    annee: number,
  ): Promise<void> {
    await this.prisma.lgBailAlertLog.create({
      data: { contractId, thresholdDays, annee },
    });
  }

  async findAvenantsByContract(contractId: string): Promise<LgBailAvenant[]> {
    return this.prisma.lgBailAvenant.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
      include: {
        file: { select: { id: true, url: true, originalName: true } },
      },
    });
  }

  async createAvenant(
    data: Prisma.LgBailAvenantCreateInput,
  ): Promise<LgBailAvenant> {
    return this.prisma.lgBailAvenant.create({ data });
  }

  async findPaiementsByContract(contractId: string): Promise<LgBailPaiement[]> {
    return this.prisma.lgBailPaiement.findMany({
      where: { contractId },
      orderBy: [{ periode: 'desc' }, { datePaiement: 'desc' }],
    });
  }

  async createPaiement(
    data: Prisma.LgBailPaiementCreateInput,
  ): Promise<LgBailPaiement> {
    return this.prisma.lgBailPaiement.create({ data });
  }

  async existsPaiement(
    contractId: string,
    periode: string,
    typePaiement: string,
  ): Promise<boolean> {
    const count = await this.prisma.lgBailPaiement.count({
      where: { contractId, periode, typePaiement: typePaiement as any },
    });
    return count > 0;
  }

  async findAllForExport(): Promise<any[]> {
    return this.prisma.lgBailContract.findMany({
      orderBy: { reference: 'asc' },
      include: {
        _count: { select: { avenants: true } },
        paiements: { orderBy: { datePaiement: 'desc' }, take: 1 },
      },
    });
  }

  async getDashboardData() {
    const now = new Date();
    const in90days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const currentPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [
      totalActifs,
      expirantDans90j,
      activeContracts,
      paiementsEnRetardCount,
      repartitionParType,
      repartitionParSite,
      calendrierEcheances,
    ] = await Promise.all([
      this.prisma.lgBailContract.count({
        where: { statut: LgBailStatut.ACTIF },
      }),
      this.prisma.lgBailContract.count({
        where: {
          statut: LgBailStatut.ACTIF,
          dateFin: { gte: now, lte: in90days },
        },
      }),
      this.prisma.lgBailContract.findMany({
        where: { statut: LgBailStatut.ACTIF },
        select: { montantMensuel: true },
      }),
      this.prisma.lgBailContract.count({
        where: {
          statut: LgBailStatut.ACTIF,
          paiements: {
            none: { periode: currentPeriode, typePaiement: 'LOYER' },
          },
        },
      }),
      this.prisma.lgBailContract.groupBy({
        by: ['type'],
        where: { statut: LgBailStatut.ACTIF },
        _count: { type: true },
      }),
      this.prisma.lgBailContract.groupBy({
        by: ['site'],
        where: { statut: LgBailStatut.ACTIF, site: { not: null } },
        _count: { site: true },
      }),
      this.prisma.lgBailContract.findMany({
        where: { statut: LgBailStatut.ACTIF, dateFin: { gte: now } },
        orderBy: { dateFin: 'asc' },
        take: 10,
        select: {
          id: true,
          reference: true,
          bailleur: true,
          objetBail: true,
          dateFin: true,
          montantMensuel: true,
        },
      }),
    ]);

    const coutMensuelTotal = activeContracts.reduce(
      (sum, c) => sum + Number(c.montantMensuel),
      0,
    );

    return {
      totalActifs,
      expirantDans90j,
      coutMensuelTotal,
      paiementsEnRetard: paiementsEnRetardCount,
      repartitionParType: repartitionParType.map((r) => ({
        type: r.type,
        count: r._count.type,
      })),
      repartitionParSite: repartitionParSite.map((r) => ({
        site: r.site,
        count: r._count.site,
      })),
      calendrierEcheances,
    };
  }

  private buildWhereClause(
    filters: FindAllBailFilters,
  ): Prisma.LgBailContractWhereInput {
    const where: Prisma.LgBailContractWhereInput = {};

    if (filters.statut) {
      where.statut = filters.statut;
    } else if (!filters.includeArchived) {
      where.statut = { not: LgBailStatut.ARCHIVE };
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.site) {
      where.site = { contains: filters.site, mode: 'insensitive' };
    }

    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { bailleur: { contains: filters.search, mode: 'insensitive' } },
        { preneur: { contains: filters.search, mode: 'insensitive' } },
        { objetBail: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
