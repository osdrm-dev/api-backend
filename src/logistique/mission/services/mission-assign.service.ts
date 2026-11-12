import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { PrismaService } from 'prisma/prisma.service';
import { VehicleStatut } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { AssignVehicleDto } from '../dto/assign-vehicle.dto';

@Injectable()
export class MissionAssignService {
  constructor(
    private readonly repository: MissionRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async assignVehicle(id: string, dto: AssignVehicleDto, managerId: number) {
    const mission = await this.repository.findById(id);
    if (!mission)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Mission ${id} not found`,
      );

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      select: { id: true, immatriculation: true, statut: true },
    });
    if (!vehicle)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Vehicle not found',
      );
    if (vehicle.statut !== VehicleStatut.ACTIF) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.VEHICLE_NOT_ACTIVE,
        'Selected vehicle is not active',
        { params: { immatriculation: vehicle.immatriculation } },
      );
    }

    const conflict = await this.repository.findVehicleConflict(
      dto.vehicleId,
      mission.departureDate,
      mission.returnDate,
      id,
    );
    if (conflict) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.MISSION_VEHICLE_CONFLICT,
        `Vehicle already assigned to mission ${conflict.reference} in this period`,
        { params: { reference: conflict.reference } },
      );
    }

    const updated = await this.repository.assignVehicle(
      id,
      dto.vehicleId,
      managerId,
    );

    try {
      if (mission.requestor?.email) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.MISSION_STATUS_CHANGED,
          [mission.requestor.email],
          id,
          {
            reference: mission.reference,
            newStatus: 'VEHICLE_ASSIGNED',
            vehicleImmatriculation: vehicle.immatriculation,
          },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back assignment
    }

    return updated;
  }
}
