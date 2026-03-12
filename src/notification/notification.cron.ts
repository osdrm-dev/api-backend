import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from './constants/notification.constants';

@Injectable()
export class NotificationCron {
  private readonly logger = new Logger(NotificationCron.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * S'exécute toutes les minutes
   * Le service gère désormais l'aiguillage interne par type
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAllNotifications() {
    this.logger.debug(
      '🚀 Lancement du cycle de traitement des notifications OSDRM...',
    );

    try {
      // On appelle une seule fois le service.
      // C'est lui qui récupère les 50 prochaines notifs PENDING (quel que soit le type)
      await this.notificationService.processAllPending();

      this.logger.debug('✅ Cycle de traitement terminé avec succès.');
    } catch (error) {
      // Gestion du type 'unknown' pour le logger
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `❌ Erreur fatale lors du cycle de notification : ${errorMessage}`,
      );
    }
  }
}
