import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  Prisma,
  Vehicle,
  VehicleDocument,
  VehicleStatut,
  VehicleDocumentType,
  LgDeplacementStatus,
  LgTripStatus,
  LgCarburantStatus,
} from '@prisma/client';

export type VehicleWithRelations = Vehicle & {
  documents: (VehicleDocument & {
    file: { id: number; url: string; originalName: string } | null;
  })[];
};

export type VehicleUsageSource = 'TRIP' | 'DEPLACEMENT' | 'CARBURANT';

/**
 * Métadonnées d'usage agrégées par véhicule pour un utilisateur (FR-4).
 */
export interface VehicleUsageAggregate {
  vehicleId: string;
  lastUsedAt: Date;
  usageCount: number;
  sources: VehicleUsageSource[];
}

/**
 * Véhicule dérivé enrichi de ses métadonnées d'usage et de ses documents actifs.
 */
export type VehicleUsedByUser = VehicleWithRelations & {
  usage: VehicleUsageAggregate;
};

/**
 * Statuts de déplacement considérés comme "validés" (FR-2) : tous sauf
 * EN_ATTENTE (en attente de validation), REFUSEE et ANNULEE.
 */
const VALIDATED_DEPLACEMENT_STATUSES: LgDeplacementStatus[] = [
  LgDeplacementStatus.VEHICULE_ATTRIBUE,
  LgDeplacementStatus.EN_ATTENTE_LOCATION,
  LgDeplacementStatus.CONFIRMEE,
  LgDeplacementStatus.EN_COURS,
  LgDeplacementStatus.LIQUIDEE,
  LgDeplacementStatus.LIQUIDATION_VALIDEE,
  LgDeplacementStatus.LIQUIDATION_REJETEE,
];

export interface FindAllFilters {
  statut?: VehicleStatut;
  marque?: string;
  search?: string;
  includeArchived?: boolean;
}

export interface FindAllPagination {
  skip: number;
  take: number;
}

@Injectable()
export class ParcAutoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    filters: FindAllFilters,
    pagination: FindAllPagination,
  ): Promise<{ data: Vehicle[]; total: number }> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          documents: {
            where: { isActive: true },
          },
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<VehicleWithRelations | null> {
    return this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
          include: { file: true },
        },
      },
    }) as Promise<VehicleWithRelations | null>;
  }

  async findPhotoFiles(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { photoFileIds: true },
    });
    if (!vehicle || vehicle.photoFileIds.length === 0) return [];
    return this.prisma.file.findMany({
      where: { id: { in: vehicle.photoFileIds } },
      select: {
        id: true,
        url: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });
  }

  async findByImmatriculation(
    immatriculation: string,
  ): Promise<Vehicle | null> {
    return this.prisma.vehicle.findUnique({
      where: { immatriculation },
    });
  }

  async create(data: Prisma.VehicleCreateInput): Promise<Vehicle> {
    return this.prisma.vehicle.create({ data });
  }

  async update(id: string, data: Prisma.VehicleUpdateInput): Promise<Vehicle> {
    return this.prisma.vehicle.update({
      where: { id },
      data,
    });
  }

  async archive(id: string): Promise<Vehicle> {
    return this.prisma.vehicle.update({
      where: { id },
      data: { statut: VehicleStatut.ARCHIVE },
    });
  }

  async appendPhoto(vehicleId: string, fileId: number): Promise<Vehicle> {
    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { photoFileIds: { push: fileId } },
    });
  }

  async removePhoto(vehicleId: string, fileId: number): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { photoFileIds: true },
    });
    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        photoFileIds: (vehicle?.photoFileIds ?? []).filter(
          (id) => id !== fileId,
        ),
      },
    });
  }

  async countDocumentFileReferences(fileId: number): Promise<number> {
    return this.prisma.vehicleDocument.count({ where: { fileId } });
  }

  async findDocumentsByVehicle(vehicleId: string): Promise<VehicleDocument[]> {
    return this.prisma.vehicleDocument.findMany({
      where: { vehicleId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: { file: true },
    });
  }

  async createDocumentSupersedingPrevious(params: {
    vehicleId: string;
    type: VehicleDocumentType;
    reference?: string;
    dateDebut?: Date;
    dateExpiration: Date;
    fileId: number;
  }): Promise<VehicleDocument> {
    const { vehicleId, type, reference, dateDebut, dateExpiration, fileId } =
      params;

    return this.prisma.$transaction(async (tx) => {
      await tx.vehicleDocument.updateMany({
        where: { vehicleId, type, isActive: true },
        data: { isActive: false },
      });

      return tx.vehicleDocument.create({
        data: {
          vehicleId,
          type,
          reference,
          dateDebut,
          dateExpiration,
          isActive: true,
          fileId,
        },
      });
    });
  }

  async findHistory(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { immatriculation: true },
    });

    if (!vehicle) return { entretien: [], carburant: [] };

    const [entretien, carburant] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where: { vehicleRef: vehicle.immatriculation, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          urgencyLevel: true,
          interventionType: true,
          scheduledAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.lgCarburant.findMany({
        where: { vehicleId, deletedAt: null },
        orderBy: { dateApprovisionnement: 'desc' },
        select: {
          id: true,
          reference: true,
          status: true,
          typeCarburant: true,
          volumeLitres: true,
          montantTotal: true,
          dateApprovisionnement: true,
          station: true,
          createdAt: true,
        },
      }),
    ]);

    return { entretien, carburant };
  }

  /**
   * Dérive les véhicules utilisés par un utilisateur en tant que `requestor`
   * (FR-1…FR-5). Interroge les trois sources (trajets, déplacements, carburant)
   * avec les exclusions FR-2, agrège par véhicule en mémoire (faible
   * cardinalité), puis charge les véhicules correspondants avec leurs documents
   * actifs. Retourne la liste triée par `lastUsedAt` décroissant.
   */
  async findVehiclesUsedByUser(userId: number): Promise<VehicleUsedByUser[]> {
    const [trips, deplacements, carburants] = await Promise.all([
      this.prisma.lgTrip.findMany({
        where: {
          requestorId: userId,
          vehicleId: { not: null },
          deletedAt: null,
          status: { not: LgTripStatus.CANCELLED },
        },
        select: { vehicleId: true, departureDate: true },
      }),
      this.prisma.lgDeplacement.findMany({
        where: {
          requestorId: userId,
          vehicleId: { not: null },
          deletedAt: null,
          status: { in: VALIDATED_DEPLACEMENT_STATUSES },
        },
        select: { vehicleId: true, dateDepart: true },
      }),
      this.prisma.lgCarburant.findMany({
        where: {
          requestorId: userId,
          vehicleId: { not: null },
          deletedAt: null,
          status: { not: LgCarburantStatus.CANCELLED },
        },
        select: { vehicleId: true, dateApprovisionnement: true },
      }),
    ]);

    const aggregates = new Map<string, VehicleUsageAggregate>();

    const accumulate = (
      vehicleId: string | null,
      usedAt: Date,
      source: VehicleUsageSource,
    ): void => {
      if (!vehicleId) return;

      const existing = aggregates.get(vehicleId);
      if (!existing) {
        aggregates.set(vehicleId, {
          vehicleId,
          lastUsedAt: usedAt,
          usageCount: 1,
          sources: [source],
        });
        return;
      }

      existing.usageCount += 1;
      if (usedAt > existing.lastUsedAt) {
        existing.lastUsedAt = usedAt;
      }
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
    };

    for (const trip of trips) {
      accumulate(trip.vehicleId, trip.departureDate, 'TRIP');
    }
    for (const deplacement of deplacements) {
      accumulate(deplacement.vehicleId, deplacement.dateDepart, 'DEPLACEMENT');
    }
    for (const carburant of carburants) {
      accumulate(
        carburant.vehicleId,
        carburant.dateApprovisionnement,
        'CARBURANT',
      );
    }

    if (aggregates.size === 0) {
      return [];
    }

    const vehicleIds = [...aggregates.keys()];

    const vehicles = (await this.prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      include: {
        documents: {
          where: { isActive: true },
          include: { file: true },
        },
      },
    })) as VehicleWithRelations[];

    return vehicles
      .map((vehicle) => ({
        ...vehicle,
        usage: aggregates.get(vehicle.id)!,
      }))
      .sort(
        (a, b) => b.usage.lastUsedAt.getTime() - a.usage.lastUsedAt.getTime(),
      );
  }

  async findDocumentsExpiringWithin(
    thresholdDays: number,
  ): Promise<(VehicleDocument & { vehicle: Vehicle })[]> {
    const now = new Date();
    let dateFrom: Date;
    let dateTo: Date;

    if (thresholdDays === 0) {
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      dateFrom = new Date(now.getTime() - twelveHoursMs);
      dateTo = new Date(now.getTime() + twelveHoursMs);
    } else {
      dateFrom = now;
      dateTo = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);
    }

    return this.prisma.vehicleDocument.findMany({
      where: {
        isActive: true,
        vehicle: { statut: VehicleStatut.ACTIF },
        dateExpiration: { gte: dateFrom, lte: dateTo },
        alertLogs: { none: { thresholdDays } },
      },
      include: { vehicle: true },
    });
  }

  async createAlertLog(
    vehicleDocumentId: string,
    thresholdDays: number,
  ): Promise<void> {
    await this.prisma.vehicleAlertLog.create({
      data: { vehicleDocumentId, thresholdDays },
    });
  }

  private buildWhereClause(filters: FindAllFilters): Prisma.VehicleWhereInput {
    const where: Prisma.VehicleWhereInput = {};

    if (filters.statut) {
      where.statut = filters.statut;
    } else if (!filters.includeArchived) {
      where.statut = VehicleStatut.ACTIF;
    }

    if (filters.marque) {
      where.marque = filters.marque;
    }

    if (filters.search) {
      where.OR = [
        { immatriculation: { contains: filters.search, mode: 'insensitive' } },
        { marque: { contains: filters.search, mode: 'insensitive' } },
        { modele: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
