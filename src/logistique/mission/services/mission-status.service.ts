import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { LgMissionStatus } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { UpdateMissionStatusDto } from '../dto/update-mission-status.dto';

const TRANSITIONS: Record<LgMissionStatus, LgMissionStatus[]> = {
  PENDING: [
    LgMissionStatus.VEHICLE_ASSIGNED,
    LgMissionStatus.PENDING_RENTAL,
    LgMissionStatus.REJECTED,
    LgMissionStatus.CANCELLED,
  ],
  PENDING_RENTAL: [
    LgMissionStatus.VEHICLE_ASSIGNED,
    LgMissionStatus.REJECTED,
    LgMissionStatus.CANCELLED,
  ],
  VEHICLE_ASSIGNED: [
    LgMissionStatus.CONFIRMED,
    LgMissionStatus.PENDING,
    LgMissionStatus.CANCELLED,
  ],
  CONFIRMED: [LgMissionStatus.IN_PROGRESS, LgMissionStatus.CANCELLED],
  IN_PROGRESS: [LgMissionStatus.SETTLED],
  SETTLED: [],
  // Statuts pilotés par le circuit de validation de liquidation (transitions
  // automatiques via SettlementValidationService), pas par l'endpoint manuel.
  SETTLEMENT_APPROVED: [],
  SETTLEMENT_REJECTED: [],
  REJECTED: [],
  CANCELLED: [],
};

const STATUS_NOTIFICATION_EVENTS: Partial<Record<LgMissionStatus, string>> = {
  REJECTED: OSDRM_PROCESS_EVENT.MISSION_STATUS_CHANGED,
  CANCELLED: OSDRM_PROCESS_EVENT.MISSION_STATUS_CHANGED,
  VEHICLE_ASSIGNED: OSDRM_PROCESS_EVENT.MISSION_STATUS_CHANGED,
  PENDING_RENTAL: OSDRM_PROCESS_EVENT.MISSION_STATUS_CHANGED,
};

@Injectable()
export class MissionStatusService {
  constructor(
    private readonly repository: MissionRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async updateStatus(
    id: string,
    dto: UpdateMissionStatusDto,
    managerId: number,
  ) {
    const mission = await this.repository.findById(id);
    if (!mission)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Mission ${id} not found`,
      );

    const allowed = TRANSITIONS[mission.status];
    if (!allowed.includes(dto.status)) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.MISSION_STATUS_TRANSITION_INVALID,
        `Invalid transition: ${mission.status} -> ${dto.status}`,
      );
    }

    if (dto.status === LgMissionStatus.REJECTED && !dto.rejectionReason) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.MISSION_REJECTION_REASON_REQUIRED,
        'A rejection reason is required to reject a request',
        {
          fields: [
            {
              field: 'rejectionReason',
              code: ErrorCode.MISSION_REJECTION_REASON_REQUIRED,
            },
          ],
        },
      );
    }

    const updated = await this.repository.updateStatus(id, dto.status, {
      ...(dto.rejectionReason ? { rejectionReason: dto.rejectionReason } : {}),
      manager: { connect: { id: managerId } },
    });

    const event = STATUS_NOTIFICATION_EVENTS[dto.status];
    if (event && mission.requestor?.email) {
      try {
        await this.notificationService.createNotification(
          event,
          [mission.requestor.email],
          id,
          {
            reference: mission.reference,
            newStatus: dto.status,
            rejectionReason: dto.rejectionReason ?? null,
          },
          false,
        );
      } catch {
        // Notification failure must not roll back status change
      }
    }

    return updated;
  }
}
