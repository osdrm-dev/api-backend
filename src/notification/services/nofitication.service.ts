import { Injectable, Logger } from '@nestjs/common';
import {
  Notification as NotificationEntity,
  NotificationStatus,
} from '@prisma/client';
import { MailService } from 'src/mail/mail.service';
import { NotificationRepository } from 'src/repository/notification/notification.repository';
import { OSDRM_PROCESS_EVENT } from '../constants/notification.constants';
import { AuditService } from 'src/audit/services/audit.service';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService, // Injecté pour récupérer l'ID de l'utilisateur
  ) {}

  async processAllPending() {
    const notifications = await this.repository.findAllPending(50);
    if (notifications.length === 0) return;

    for (const notif of notifications) {
      try {
        switch (notif.type) {
          case OSDRM_PROCESS_EVENT.DA_CREATED:
            await this.sendNotificationForDACreated(notif);
            break;
          case OSDRM_PROCESS_EVENT.BC_UPLOADED:
            await this.sendNotificationForBCUploaded(notif);
            break;
          case OSDRM_PROCESS_EVENT.PV_UPLOADED:
            await this.sendNotificationForPVUploaded(notif);
            break;
          case OSDRM_PROCESS_EVENT.QR_UPLOADED:
            await this.sendNotificationForQRUploaded(notif);
            break;
          case OSDRM_PROCESS_EVENT.FORGOT_PASSWORD:
            await this.sendNotificationForForgotPassword(notif);
            break;
          case OSDRM_PROCESS_EVENT.DPA_CREATED:
            await this.sendNotificationForDPACreated(notif);
            break;
          default:
            this.logger.warn(`Évènement non géré : ${notif.type}`);
            continue;
        }

        // 1. Mise à jour du statut après succès d'envoi
        const updatedNotif = await this.repository.updateStatusAfterSend(
          notif.id,
          NotificationStatus.SENT,
        );

        // 2. Recherche du destinataire pour l'AuditLog
        const recipientEmail = notif.recipients?.[0];
        let targetUserId: number = 0; // 0 ou un ID système spécifique de type number

        if (recipientEmail) {
          const user = await this.prisma.user.findUnique({
            where: { email: recipientEmail },
            select: { id: true },
          });

          if (user) {
            // Conversion explicite en number au cas où l'ID serait récupéré différemment
            targetUserId = Number(user.id);
          }
        }

        // 3. Création de l'Audit Log lié à l'utilisateur destinataire
        await this.auditService.log({
          userId: targetUserId,
          action: 'NOTIFICATION_SENT',
          resource: 'Notification',
          resourceId: notif.id,
          details: {
            type: notif.type,
            recipientEmail: recipientEmail,
            resourceReference: notif.resourceId,
            attempts: updatedNotif.attemptCount,
          },
          ipAddress: '127.0.0.1',
        });

        this.logger.debug(
          `Statut mis à jour et AuditLog créé pour la notification ${notif.id}`,
        );
      } catch (error) {
        const err = error as Error;
        await this.repository.updateStatusAfterSend(
          notif.id,
          NotificationStatus.PENDING,
        );
        this.logger.error(
          `Erreur lors du traitement de la notif ${notif.id}:`,
          err.message,
        );
      }
    }
  }

  // --- Méthodes privées d'envoi ---

  private async sendNotificationForDACreated(notif: NotificationEntity) {
    const data = notif.data as any;
    await this.mailService.sendSimpleMail(
      notif.recipients?.[0],
      `Nouvelle DA créée : ${data.reference || notif.resourceId}`,
      `<p>Une nouvelle demande d'achat a été créée.</p>
       <ul><li>Référence : ${data.reference}</li><li>Auteur : ${data.author}</li></ul>`,
    );
    this.logger.log(`[DA_CREATED] Mail envoyé pour ${notif.resourceId}`);
  }

  private async sendNotificationForBCUploaded(notif: NotificationEntity) {
    await this.mailService.sendSimpleMail(
      notif.recipients?.[0],
      `BC déposé : ${notif.resourceId}`,
      `<p>Le Bon de Commande pour la ressource <strong>${notif.resourceId}</strong> a été téléchargé.</p>`,
    );
    this.logger.log(`[BC_UPLOADED] Mail envoyé pour ${notif.resourceId}`);
  }

  private async sendNotificationForPVUploaded(notif: NotificationEntity) {
    await this.mailService.sendSimpleMail(
      notif.recipients?.[0],
      `PV disponible : ${notif.resourceId}`,
      `<p>Un nouveau Procès Verbal (PV) a été ajouté pour consultation.</p>`,
    );
    this.logger.log(`[PV_UPLOADED] Mail envoyé pour ${notif.resourceId}`);
  }

  private async sendNotificationForQRUploaded(notif: NotificationEntity) {
    await this.mailService.sendSimpleMail(
      notif.recipients?.[0],
      `Réponse Q&R : ${notif.resourceId}`,
      `<p>Une nouvelle réponse a été apportée à votre question sur la ressource ${notif.resourceId}.</p>`,
    );
    this.logger.log(`[QR_UPLOADED] Mail envoyé pour ${notif.resourceId}`);
  }

  private async sendNotificationForForgotPassword(notif: NotificationEntity) {
    const data = notif.data as any;
    await this.mailService.sendConfirmation(
      notif.recipients?.[0],
      data.token || 'reset-token',
    );
    this.logger.log(
      `[FORGOT_PASSWORD] Mail de reset envoyé à ${notif.recipients?.[0]}`,
    );
  }

  private async sendNotificationForDPACreated(notif: NotificationEntity) {
    const data = notif.data as any;
    await this.mailService.sendSimpleMail(
      notif.recipients?.[0],
      `DPA générée : ${data.reference || notif.resourceId}`,
      `<p>Une demande de paiement anticipé a été créée pour la référence <strong>${data.reference}</strong>.</p>`,
    );
    this.logger.log(`[DPA_CREATED] Mail envoyé pour ${notif.resourceId}`);
  }
}
