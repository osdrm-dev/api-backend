import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'prisma/prisma.service';
import { BauxRepository } from 'src/repository/baux/baux.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';

const ALERT_THRESHOLDS = [90, 30, 15, 7];

@Injectable()
export class BailExpiryAlertCron {
  private readonly logger = new Logger(BailExpiryAlertCron.name);

  constructor(
    private readonly bauxRepository: BauxRepository,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 8 * * *')
  async handleExpiryAlerts(): Promise<void> {
    this.logger.log('[BAUX] Vérification des contrats expirants...');

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { email: true },
    });

    if (admins.length === 0) {
      this.logger.warn('[BAUX] Aucun administrateur actif trouvé, abandon.');
      return;
    }

    const recipients = admins.map((a) => a.email);
    const currentYear = new Date().getFullYear();

    for (const threshold of ALERT_THRESHOLDS) {
      const contracts = await this.bauxRepository.findExpiringContracts(
        threshold,
        currentYear,
      );

      for (const contract of contracts) {
        try {
          await this.notificationService.createNotification(
            OSDRM_PROCESS_EVENT.BAIL_EXPIRY_ALERT,
            recipients,
            contract.id,
            {
              contractId: contract.id,
              reference: contract.reference,
              bailleur: contract.bailleur,
              objetBail: contract.objetBail,
              dateFin: contract.dateFin,
              thresholdDays: threshold,
            },
          );

          await this.bauxRepository.createAlertLog(
            contract.id,
            threshold,
            currentYear,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `[BAUX] Erreur alerte contrat ${contract.reference} (seuil ${threshold}j) : ${msg}`,
          );
        }
      }
    }

    this.logger.log('[BAUX] Vérification des contrats expirants terminée.');
  }
}
