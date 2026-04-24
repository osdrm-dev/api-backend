import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'prisma/prisma.service';
import { ParcAutoRepository } from 'src/repository/parc-auto/parc-auto.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';

const ALERT_THRESHOLDS = [30, 15, 7, 0];

@Injectable()
export class ParcAutoAlertCron {
  private readonly logger = new Logger(ParcAutoAlertCron.name);

  constructor(
    private readonly parcAutoRepository: ParcAutoRepository,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 8 * * *')
  async handleExpiryAlerts(): Promise<void> {
    this.logger.log('[PARC AUTO] Vérification des documents expirants...');

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { email: true },
    });

    if (admins.length === 0) {
      this.logger.warn(
        '[PARC AUTO] Aucun administrateur actif trouvé, abandon.',
      );
      return;
    }

    const recipients = admins.map((a) => a.email);

    for (const threshold of ALERT_THRESHOLDS) {
      const expiringDocs =
        await this.parcAutoRepository.findDocumentsExpiringWithin(threshold);

      for (const doc of expiringDocs) {
        try {
          await this.notificationService.createNotification(
            OSDRM_PROCESS_EVENT.VEHICLE_DOCUMENT_EXPIRY_ALERT,
            recipients,
            doc.id,
            {
              vehicleId: doc.vehicleId,
              immatriculation: doc.vehicle.immatriculation,
              documentType: doc.type,
              reference: doc.reference ?? null,
              dateExpiration: doc.dateExpiration,
              thresholdDays: threshold,
            },
          );

          await this.parcAutoRepository.createAlertLog(doc.id, threshold);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `[PARC AUTO] Erreur alerte document ${doc.id} (seuil ${threshold}j) : ${msg}`,
          );
        }
      }
    }

    this.logger.log(
      '[PARC AUTO] Vérification des documents expirants terminée.',
    );
  }
}
