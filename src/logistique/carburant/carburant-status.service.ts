import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LgCarburantStatus } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { CarburantRepository } from 'src/repository/carburant/carburant.repository';

const TERMINAL_STATUSES: LgCarburantStatus[] = [
  LgCarburantStatus.PROCESSED,
  LgCarburantStatus.CANCELLED,
];

@Injectable()
export class CarburantStatusService {
  constructor(
    private readonly carburantRepository: CarburantRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async updateStatus(id: string, newStatus: LgCarburantStatus) {
    const carburant = await this.carburantRepository.findById(id);
    if (!carburant) {
      throw new NotFoundException(
        `Approvisionnement carburant ${id} introuvable.`,
      );
    }

    if (TERMINAL_STATUSES.includes(carburant.status)) {
      throw new UnprocessableEntityException(
        'Impossible de modifier le statut : la demande est déjà dans un état terminal.',
      );
    }

    const updated = await this.carburantRepository.updateStatus(id, newStatus);

    try {
      if (carburant.requestor?.email) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.FUEL_SUPPLY_STATUS_CHANGED,
          [carburant.requestor.email],
          id,
          { reference: carburant.reference, newStatus },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back status change
    }

    return updated;
  }
}
