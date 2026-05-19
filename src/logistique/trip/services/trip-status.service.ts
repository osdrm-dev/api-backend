import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LgTripStatus } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { TripRepository } from 'src/repository/trip/trip.repository';

const TERMINAL_STATUSES: LgTripStatus[] = [
  LgTripStatus.PROCESSED,
  LgTripStatus.CANCELLED,
];

@Injectable()
export class TripStatusService {
  constructor(
    private readonly tripRepository: TripRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async updateStatus(id: string, newStatus: LgTripStatus) {
    const trip = await this.tripRepository.findById(id);
    if (!trip) throw new NotFoundException(`Trajet ${id} introuvable.`);

    if (TERMINAL_STATUSES.includes(trip.status)) {
      throw new UnprocessableEntityException(
        'Cannot transition from a terminal status',
      );
    }

    const updated = await this.tripRepository.updateStatus(id, newStatus);

    try {
      if (trip.requestor?.email) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.TRIP_STATUS_CHANGED,
          [trip.requestor.email],
          id,
          { reference: trip.reference, newStatus },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back status change
    }

    return updated;
  }
}
