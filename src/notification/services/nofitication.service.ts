import { Injectable, Logger } from '@nestjs/common';
import {
  Notification as NotificationEntity,
  NotificationStatus,
} from '@prisma/client';
import { MailService } from 'src/mail/mail.service';
import { NotificationRepository } from 'src/repository/notification/notification.repository';
import { NOTIFICATION_TYPES } from '../constants/notification.constants';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly mailService: MailService,
  ) {}

  async processAllPending() {
    const notifications = await this.repository.findAllPending(50);
    if (notifications.length === 0) return;

    for (const notif of notifications) {
      try {
        switch (notif.type) {
          case NOTIFICATION_TYPES.DA_CREATE:
            await this.sendNotificationForDACreate(notif);
            break;
          case NOTIFICATION_TYPES.UPLOAD_BC:
            await this.sendNotificationForUploadBC(notif);
            break;
          case NOTIFICATION_TYPES.UPLOAD_PV:
            await this.sendNotificationForUploadPV(notif);
            break;
          case NOTIFICATION_TYPES.UPLOAD_QR:
            await this.sendNotificationForUploadQR(notif);
            break;
          case NOTIFICATION_TYPES.FORGOT_PASSWORD:
            await this.sendNotificationForForgotPassword(notif);
            break;
          case NOTIFICATION_TYPES.CREATE_DPA:
            await this.sendNotificationForCreateDPA(notif);
            break;
          default:
            this.logger.warn(`Type non géré : ${notif.type}`);
        }

        await this.repository.updateStatusAfterSend(notif.id, 'SENT');
        this.logger.debug(
          `Statut mis à jour : SENT pour la notification ${notif.id}`,
        );
      } catch (error) {
        await this.repository.updateStatusAfterSend(notif.id, 'PENDING');
        this.logger.error(
          `Erreur lors du traitement de la notif ${notif.id}:`,
          error,
        );
      }
    }
  }

  private async sendNotificationForDACreate(notif: NotificationEntity) {
    const data = notif.data as any;
    await this.mailService.sendSimpleMail(
      notif.recipients?.[0],
      `Nouvelle DA : ${data.reference || notif.resourceId}`,
      `<p>Une nouvelle demande d'achat a été créée.</p>
       <ul><li>Référence : ${data.reference}</li><li>Auteur : ${data.author}</li></ul>`,
    );
    this.logger.log(`[DA_CREATE] Mail envoyé pour ${notif.resourceId}`);
  }

  private async sendNotificationForUploadBC(notif: NotificationEntity) {
    const data = notif.data as any;
    await this.mailService.sendSimpleMail(
      notif.recipients?.[0],
      `BC disponible : ${notif.resourceId}`,
      `<p>Le Bon de Commande pour la ressource <strong>${notif.resourceId}</strong> a été déposé.</p>`,
    );
    this.logger.log(`[UPLOAD_BC] Mail envoyé pour ${notif.resourceId}`);
  }

  private async sendNotificationForUploadPV(notif: NotificationEntity) {
    await this.mailService.sendSimpleMail(
      notif.recipients?.[0],
      `PV téléchargé : ${notif.resourceId}`,
      `<p>Un nouveau Procès Verbal (PV) est disponible pour consultation.</p>`,
    );
    this.logger.log(`[UPLOAD_PV] Mail envoyé pour ${notif.resourceId}`);
  }

  private async sendNotificationForUploadQR(notif: NotificationEntity) {
    await this.mailService.sendSimpleMail(
      notif.recipients?.[0],
      `Nouvelle Q&R : ${notif.resourceId}`,
      `<p>Une nouvelle réponse a été apportée à votre question sur la ressource ${notif.resourceId}.</p>`,
    );
    this.logger.log(`[UPLOAD_QR] Mail envoyé pour ${notif.resourceId}`);
  }

  private async sendNotificationForForgotPassword(notif: NotificationEntity) {
    const data = notif.data as any;
    // On utilise ta méthode sendConfirmation qui gère déjà le token/link
    await this.mailService.sendConfirmation(
      notif.recipients?.[0],
      data.token || 'reset-token',
    );
    this.logger.log(
      `[FORGOT_PASSWORD] Mail de reset envoyé à ${notif.recipients?.[0]}`,
    );
  }

  private async sendNotificationForCreateDPA(notif: NotificationEntity) {
    const data = notif.data as any;
    await this.mailService.sendSimpleMail(
      notif.recipients?.[0],
      `Nouvelle DPA : ${data.reference || notif.resourceId}`,
      `<p>Une demande de paiement anticipé a été générée pour la référence <strong>${data.reference}</strong>.</p>`,
    );
    this.logger.log(`[CREATE_DPA] Mail envoyé pour ${notif.resourceId}`);
  }
}
