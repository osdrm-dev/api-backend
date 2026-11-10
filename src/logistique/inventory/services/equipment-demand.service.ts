import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { EquipmentDemandRepository } from 'src/repository/inventory/equipment-demand.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { CreateEquipmentDemandDto } from '../dto/create-equipment-demand.dto';
import { UpdateEquipmentDemandStatusDto } from '../dto/update-equipment-demand-status.dto';
import { FilterEquipmentDemandDto } from '../dto/filter-equipment-demand.dto';

@Injectable()
export class EquipmentDemandService {
  constructor(
    private readonly repository: EquipmentDemandRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateEquipmentDemandDto, requestorId: number) {
    const fileIds = [...new Set(dto.fileIds ?? [])];
    // Only the requester's own uploads can be attached.
    if (
      fileIds.length &&
      (await this.repository.countFilesUploadedBy(fileIds, requestorId)) !==
        fileIds.length
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.EQUIPMENT_DEMAND_FILES_NOT_FOUND,
        'One or more attached documents were not found',
        {
          fields: [
            {
              field: 'fileIds',
              code: ErrorCode.EQUIPMENT_DEMAND_FILES_NOT_FOUND,
            },
          ],
        },
      );
    }

    const year = new Date().getFullYear();
    const reference = await this.repository.generateReference(year);

    return this.repository.create({
      reference,
      requestorId,
      categoryId: dto.categoryId,
      desiredType: dto.desiredType,
      quantity: dto.quantity,
      justification: dto.justification,
      fileIds,
    });
  }

  async findAll(query: FilterEquipmentDemandDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { data, total } = await this.repository.findAll(
      {
        status: query.status,
        categoryId: query.categoryId,
        requestorId: query.requestorId,
      },
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

  async findAllForRequestor(
    requestorId: number,
    query: FilterEquipmentDemandDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { data, total } = await this.repository.findAllForRequestor(
      requestorId,
      {
        status: query.status,
        categoryId: query.categoryId,
      },
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

  async findById(id: string) {
    const demand = await this.repository.findById(id);
    if (!demand) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment demand not found',
      );
    }
    return demand;
  }

  async findByIdForUser(id: string, userId: number) {
    const demand = await this.repository.findById(id);
    if (!demand) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment demand not found',
      );
    }
    if (demand.requestorId !== userId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.EQUIPMENT_DEMAND_ACCESS_DENIED,
        'Access denied: you can only access your own demands',
      );
    }
    return demand;
  }

  async updateStatus(
    id: string,
    dto: UpdateEquipmentDemandStatusDto,
    adminUserId: number,
  ) {
    const demand = await this.repository.findById(id);
    if (!demand) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment demand not found',
      );
    }

    const updated = await this.repository.updateStatus(
      id,
      dto.status,
      dto.adminNote,
    );

    if (demand.requestorId) {
      const requestor = demand.requestor as any;
      const recipientEmail = requestor?.email;
      if (recipientEmail) {
        const expiredAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.IT_DEMANDE_STATUS_CHANGED,
          [recipientEmail],
          id,
          {
            reference: demand.reference,
            desiredType: demand.desiredType,
            newStatus: dto.status,
            adminNote: dto.adminNote ?? null,
          },
          false,
          expiredAt,
        );
      }
    }

    return updated;
  }
}
