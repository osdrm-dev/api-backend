import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
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
    if (!trip)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Trip ${id} not found`,
      );

    if (TERMINAL_STATUSES.includes(trip.status)) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.TRIP_STATUS_TERMINAL,
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
