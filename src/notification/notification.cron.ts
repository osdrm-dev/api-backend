import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './services/nofitication.service';
import { NOTIFICATION_TYPES } from './constants/notification.constants';

@Injectable()
export class NotificationCron {
  private readonly logger = new Logger(NotificationCron.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * S'exécute toutes les minutes
   * On boucle sur chaque type pour déclencher le traitement spécifique
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAllNotifications() {
    this.logger.debug('Lancement du cycle de traitement des notifications...');

    // On récupère les valeurs : ['DA_CREATE', 'UPLOAD_BC', ...]
    const types = Object.values(NOTIFICATION_TYPES);

    for (const type of types) {
      try {
        await this.notificationService.processAllPending();
      } catch (error) {
        this.logger.error(`Erreur fatale lors du traitement du type ${type}`);
      }
    }

    this.logger.debug('Cycle de traitement terminé.');
  }
}
