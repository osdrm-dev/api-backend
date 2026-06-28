import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MaintenanceStatus } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import {
  MaintenanceFilters,
  MaintenanceRepository,
} from 'src/repository/maintenance/maintenance.repository';
import { CreateMaintenanceRequestDto } from '../dto/create-maintenance-request.dto';
import { FilterMaintenanceDto } from '../dto/filter-maintenance.dto';
import { UpdateMaintenanceRequestDto } from '../dto/update-maintenance-request.dto';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly repository: MaintenanceRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createRequest(dto: CreateMaintenanceRequestDto, requestorId: number) {
    let vehicleConnect: { connect: { id: string } } | undefined;
    let vehicleRef: string | undefined;

    if (dto.vehicleId || dto.immatriculation) {
      const where = dto.vehicleId
        ? { id: dto.vehicleId }
        : { immatriculation: dto.immatriculation! };

      const vehicle = await this.prisma.vehicle.findUnique({ where });

      if (!vehicle) {
        const identifier = dto.vehicleId ?? dto.immatriculation;
        throw new UnprocessableEntityException(
          `Véhicule ${identifier} introuvable.`,
        );
      }

      if (vehicle.statut !== 'ACTIF') {
        throw new UnprocessableEntityException(
          `Le véhicule ${vehicle.immatriculation} n'est pas actif.`,
        );
      }

      vehicleConnect = { connect: { id: vehicle.id } };
      vehicleRef = vehicle.immatriculation;
    }

    const year = new Date().getFullYear();
    let reference: string;

    for (let attempt = 0; attempt < 5; attempt++) {
      reference = await this.repository.generateReference(year);
      try {
        return await this.repository.create({
          reference,
          interventionType: dto.interventionType,
          urgencyLevel: dto.urgencyLevel,
          title: dto.title,
          description: dto.description,
          location: dto.location,
          vehicleRef,
          ...(vehicleConnect && { vehicle: vehicleConnect }),
          requestor: { connect: { id: requestorId } },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      'Impossible de générer une référence unique pour cette demande.',
    );
  }

  async getRequestForRequestor(id: string, requestorId: number) {
    const request = await this.repository.findById(id);

    if (!request || request.deletedAt !== null) {
      throw new NotFoundException('Demande de maintenance introuvable.');
    }

    if (request.requestorId !== requestorId) {
      throw new NotFoundException('Demande de maintenance introuvable.');
    }

    return request;
  }

  async getRequestAdmin(id: string) {
    const request = await this.repository.findById(id);

    if (!request || request.deletedAt !== null) {
      throw new NotFoundException('Demande de maintenance introuvable.');
    }

    return request;
  }

  async getAllAdmin(query: FilterMaintenanceDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filters: MaintenanceFilters = {
      status: query.status,
      urgencyLevel: query.urgencyLevel,
      interventionType: query.interventionType,
      vehicleId: query.vehicleId,
      vehicleRef: query.vehicleRef,
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };

    const { data, total } = await this.repository.findAllAdmin(filters, {
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllForRequestor(requestorId: number, query: FilterMaintenanceDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filters: MaintenanceFilters = {
      status: query.status,
      urgencyLevel: query.urgencyLevel,
      interventionType: query.interventionType,
      vehicleId: query.vehicleId,
      vehicleRef: query.vehicleRef,
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };

    const { data, total } = await this.repository.findAllForRequestor(
      requestorId,
      filters,
      { skip, take: limit },
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats() {
    return this.repository.findStats();
  }

  async updateRequestor(
    id: string,
    dto: UpdateMaintenanceRequestDto,
    requestorId: number,
  ) {
    const request = await this.repository.findById(id);

    if (!request || request.deletedAt !== null) {
      throw new NotFoundException('Demande de maintenance introuvable.');
    }

    if (request.requestorId !== requestorId) {
      throw new NotFoundException('Demande de maintenance introuvable.');
    }

    if (request.status !== MaintenanceStatus.PENDING) {
      throw new ForbiddenException('Cette demande ne peut plus être modifiée.');
    }

    let vehicleId: string | null | undefined;
    let vehicleRef: string | undefined;

    if (dto.vehicleId || dto.immatriculation) {
      const where = dto.vehicleId
        ? { id: dto.vehicleId }
        : { immatriculation: dto.immatriculation! };

      const vehicle = await this.prisma.vehicle.findUnique({ where });

      if (!vehicle) {
        const identifier = dto.vehicleId ?? dto.immatriculation;
        throw new UnprocessableEntityException(
          `Véhicule ${identifier} introuvable.`,
        );
      }

      if (vehicle.statut !== 'ACTIF') {
        throw new UnprocessableEntityException(
          `Le véhicule ${vehicle.immatriculation} n'est pas actif.`,
        );
      }

      vehicleId = vehicle.id;
      vehicleRef = vehicle.immatriculation;
    }

    return this.repository.update(id, {
      title: dto.title,
      description: dto.description,
      urgencyLevel: dto.urgencyLevel,
      location: dto.location,
      vehicleId,
      vehicleRef,
    });
  }

  async softDeleteRequest(id: string, requestorId: number) {
    const request = await this.repository.findById(id);

    if (!request || request.deletedAt !== null) {
      throw new NotFoundException('Demande de maintenance introuvable.');
    }

    if (request.requestorId !== requestorId) {
      throw new NotFoundException('Demande de maintenance introuvable.');
    }

    if (request.status !== MaintenanceStatus.PENDING) {
      throw new ForbiddenException('Cette demande ne peut plus être modifiée.');
    }

    return this.repository.softDelete(id);
  }
}
