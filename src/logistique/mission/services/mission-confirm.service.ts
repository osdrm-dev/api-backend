import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { Prisma, LgMissionStatus } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { ConfirmMissionDto } from '../dto/confirm-mission.dto';

@Injectable()
export class MissionConfirmService {
  constructor(
    private readonly repository: MissionRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async confirm(id: string, dto: ConfirmMissionDto, managerId: number) {
    const mission = await this.repository.findById(id);
    if (!mission)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Mission ${id} not found`,
      );

    if (mission.status !== LgMissionStatus.VEHICLE_ASSIGNED) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.MISSION_CONFIRM_VEHICLE_REQUIRED,
        `Cannot confirm mission in status ${mission.status}: vehicle must be assigned first`,
      );
    }

    const updated = await this.repository.confirm(
      id,
      managerId,
      new Prisma.Decimal(dto.perDiemAmount),
      dto.additionalInstructions,
    );

    try {
      if (mission.requestor?.email) {
        const expiredAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.MISSION_CONFIRMED,
          [mission.requestor.email],
          id,
          {
            reference: mission.reference,
            destination: mission.destination,
            departureDate: mission.departureDate,
            returnDate: mission.returnDate,
            perDiemAmount: dto.perDiemAmount,
            vehicleImmatriculation: mission.vehicle?.immatriculation ?? null,
          },
          false,
          expiredAt,
        );
      }
    } catch {
      // Notification failure must not roll back confirmation
    }

    return updated;
  }
}
