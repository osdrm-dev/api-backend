import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './services/nofitication.service';

@Injectable()
export class NotificationCron {
  private readonly logger = new Logger(NotificationCron.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * CYCLE 1 : Envoi initial
   * S'exécute toutes les minutes pour traiter les nouvelles notifications (PENDING)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handlePendingNotifications() {
    this.logger.debug('[PENDING] Traitement des nouveaux envois...');

    try {
      await this.notificationService.processAllPending();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur cycle PENDING : ${msg}`);
    }
  }

  /**
   * CYCLE 2 : Rappels (Reminders)
   * S'exécute toutes les heures (par exemple)
   * Scanne les notifications SENT qui ont hasReminder=true et qui datent de plus de 24h
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleReminders() {
    this.logger.debug(
      '[REMINDER] Vérification des notifications à relancer...',
    );

    try {
      await this.notificationService.processReminders();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur cycle REMINDER : ${msg}`);
    }
  }
}
