import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  Prisma,
  Vehicle,
  VehicleDocument,
  VehicleStatut,
  VehicleDocumentType,
} from '@prisma/client';

export type VehicleWithRelations = Vehicle & {
  documents: (VehicleDocument & {
    file: { id: number; url: string; originalName: string } | null;
  })[];
};

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
