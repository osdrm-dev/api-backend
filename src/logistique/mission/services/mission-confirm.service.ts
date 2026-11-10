import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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

  async confirm(id: string, dto: ConfirmMissionDto, gestionnaireId: number) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Trajet ${id} introuvable.`);

    if (dep.status !== LgMissionStatus.VEHICLE_ASSIGNED) {
      throw new UnprocessableEntityException(
        `Impossible de confirmer un trajet en statut ${dep.status}. Le véhicule doit d'abord être attribué.`,
      );
    }

    const updated = await this.repository.confirm(
      id,
      gestionnaireId,
      new Prisma.Decimal(dto.perDiemAmount),
      dto.additionalInstructions,
    );

    try {
      if (dep.requestor?.email) {
        const expiredAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.MISSION_CONFIRMED,
          [dep.requestor.email],
          id,
          {
            reference: dep.reference,
            destination: dep.destination,
            departureDate: dep.departureDate,
            returnDate: dep.returnDate,
            perDiemAmount: dto.perDiemAmount,
            vehicleImmatriculation: dep.vehicle?.immatriculation ?? null,
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
