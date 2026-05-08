import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MaintenanceStatus } from '@prisma/client';
import {
  MaintenanceFilters,
  MaintenanceRepository,
} from 'src/repository/maintenance/maintenance.repository';
import { CreateMaintenanceRequestDto } from '../dto/create-maintenance-request.dto';
import { FilterMaintenanceDto } from '../dto/filter-maintenance.dto';
import { UpdateMaintenanceRequestDto } from '../dto/update-maintenance-request.dto';

@Injectable()
export class MaintenanceService {
  constructor(private readonly repository: MaintenanceRepository) {}

  async createRequest(dto: CreateMaintenanceRequestDto, requestorId: number) {
    const year = new Date().getFullYear();
    let reference: string;

    // Retry on collision (unlikely but defensive)
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
          vehicleRef: dto.vehicleRef,
          requestorId,
        });
      } catch (err: any) {
        // P2002 = unique constraint violation on reference
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

    return this.repository.update(id, {
      title: dto.title,
      description: dto.description,
      urgencyLevel: dto.urgencyLevel,
      location: dto.location,
      vehicleRef: dto.vehicleRef,
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
