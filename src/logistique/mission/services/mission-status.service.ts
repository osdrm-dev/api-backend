import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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
    if (!mission) throw new NotFoundException(`Trajet ${id} introuvable.`);

    const allowed = TRANSITIONS[mission.status];
    if (!allowed.includes(dto.status)) {
      throw new UnprocessableEntityException(
        `Transition invalide : ${mission.status} → ${dto.status}.`,
      );
    }

    if (dto.status === LgMissionStatus.REJECTED && !dto.rejectionReason) {
      throw new UnprocessableEntityException(
        'Un motif de refus est requis pour rejeter une demande.',
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
