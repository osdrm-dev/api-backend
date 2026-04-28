import { Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceRepository } from 'src/repository/maintenance/maintenance.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { PrismaService } from 'prisma/prisma.service';
import { UpdateMaintenanceStatusDto } from '../dto/update-maintenance-status.dto';

@Injectable()
export class MaintenanceStatusService {
  constructor(
    private readonly repository: MaintenanceRepository,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  async updateStatus(
    requestId: string,
    dto: UpdateMaintenanceStatusDto,
    adminUserId: number,
  ) {
    const request = await this.repository.findById(requestId);

    if (!request || request.deletedAt !== null) {
      throw new NotFoundException('Demande de maintenance introuvable.');
    }

    // Same status — return current without notification
    if (request.status === dto.status) {
      return request;
    }

    const updated = await this.repository.updateStatus(
      requestId,
      dto.status,
      adminUserId,
      dto.adminNote,
    );

    // Fire notification if requestor exists
    if (request.requestorId) {
      try {
        const requestor = await this.prisma.user.findUnique({
          where: { id: request.requestorId },
          select: { email: true },
        });

        if (requestor?.email) {
          await this.notificationService.createNotification(
            OSDRM_PROCESS_EVENT.MAINTENANCE_STATUS_CHANGED,
            [requestor.email],
            requestId,
            {
              reference: request.reference,
              title: request.title,
              newStatus: dto.status,
              adminNote: dto.adminNote ?? null,
              requestUrl: null,
            },
            false,
            new Date(Date.now() + 24 * 60 * 60 * 1000),
          );
        }
      } catch {
        // Notification failure must not break the response
      }
    }

    return updated;
  }
}
