import { Injectable, Logger } from '@nestjs/common';
import {
  Notification as NotificationEntity,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { MailService } from 'src/mail/mail.service';
import { NotificationRepository } from 'src/repository/notification/notification.repository';
import { OSDRM_PROCESS_EVENT } from '../constants/notification.constants';
import { AuditService } from 'src/audit/services/audit.service';
import { PrismaService } from 'prisma/prisma.service';

/**
 * Helper
 */
const daysToMs = (days: number): number => days * 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly DEFAULT_REMINDER_INTERVAL_IN_DAYS = 1;

  constructor(
    private readonly repository: NotificationRepository,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Crée une notification
   */
  async createNotification(
    type: string,
    recipients: string[],
    resourceId: string,
    data: any,
    hasReminder: boolean = false,
    expiredAt?: Date,
    reminderIntervalInDays?: number,
  ) {
    const finalExpiredAt = expiredAt ?? new Date(Date.now() + daysToMs(7));

    return await this.prisma.notification.create({
      data: {
        type,
        resourceId,
        recipients: recipients as Prisma.JsonArray,
        data: data as Prisma.JsonObject,
        status: NotificationStatus.PENDING,
        hasReminder: hasReminder,
        reminderIntervalInDays: hasReminder
          ? (reminderIntervalInDays ?? this.DEFAULT_REMINDER_INTERVAL_IN_DAYS)
          : null,
        reminderCount: 0,
        attemptCount: 0,
        expiredAt: finalExpiredAt,
      },
    });
  }

  /**
   * Cycle 1 : Traitement des nouvelles notifications (PENDING)
   */
  async processAllPending() {
    const notifications = await this.repository.findAllPending(10);
    if (notifications.length === 0) return;

    for (const notif of notifications) {
      try {
        await this.dispatchNotification(notif);

        const updated = await this.prisma.notification.update({
          where: { id: notif.id },
          data: {
            status: NotificationStatus.SENT,
            lastSentAt: new Date(),
            attemptCount: { increment: 1 },
          },
        });

        await this.logAudit(updated, 'NOTIFICATION_SENT');
      } catch (error) {
        await this.handleError(notif, error);
      }
    }
  }

  /**
   * Cycle 2 : Gestion des rappels
   */
  async processReminders() {
    const now = new Date();

    const notificationsToRemind = await this.repository.findEligibleForReminder(
      now,
      this.DEFAULT_REMINDER_INTERVAL_IN_DAYS,
    );

    this.logger.debug(`Recherche de rappels à : ${now.toISOString()}`);
    this.logger.debug(
      `Nombre de rappels trouvés : ${notificationsToRemind.length}`,
    );

    if (notificationsToRemind.length === 0) return;

    for (const notif of notificationsToRemind) {
      try {
        await this.dispatchNotification(notif);

        const updated = await this.prisma.notification.update({
          where: { id: notif.id },
          data: {
            reminderCount: { increment: 1 },
            lastSentAt: new Date(),
            attemptCount: { increment: 1 },
          },
        });

        await this.logAudit(updated, 'NOTIFICATION_REMINDER_SENT');
        this.logger.log(`Rappel envoyé pour ${notif.id}`);
      } catch (error) {
        await this.handleError(notif, error);
      }
    }
  }

  /**
   * Aiguilleur central pour l'envoi de mail
   */
  private async dispatchNotification(notif: NotificationEntity) {
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
        throw new Error(`Type d'évènement non supporté : ${notif.type}`);
    }
  }

  private async logAudit(notif: NotificationEntity, action: string) {
    const recipientEmail = (notif.recipients as string[])?.[0];
    let userId = 0;

    if (recipientEmail) {
      const user = await this.prisma.user.findUnique({
        where: { email: recipientEmail },
        select: { id: true },
      });
      if (user) userId = Number(user.id);
    }

    await this.auditService.log({
      userId,
      action,
      resource: 'Notification',
      resourceId: notif.id,
      details: {
        type: notif.type,
        reminderCount: notif.reminderCount,
        attempts: notif.attemptCount,
        intervalInDays: notif.reminderIntervalInDays,
      },
    });
  }

  private async handleError(notif: NotificationEntity, error: any) {
    this.logger.error(`Erreur sur notif ${notif.id}: ${error.message}`);
    await this.prisma.notification.update({
      where: { id: notif.id },
      data: { attemptCount: { increment: 1 } },
    });
  }

  // --- Templates d'envoi ---
  private async sendNotificationForDACreated(notif: NotificationEntity) {
    const data = notif.data as any;
    const recipients = notif.recipients as string[];
    await this.mailService.sendSimpleMail(
      recipients[0],
      `Nouvelle DA créée : ${data.reference || notif.resourceId}`,
      `<p>Une nouvelle demande d'achat a été créée.</p><ul><li>Référence : ${data.reference}</li></ul>`,
    );
  }

  private async sendNotificationForBCUploaded(notif: NotificationEntity) {
    const recipients = notif.recipients as string[];
    await this.mailService.sendSimpleMail(
      recipients[0],
      `BC déposé : ${notif.resourceId}`,
      `<p>Le Bon de Commande pour <strong>${notif.resourceId}</strong> est disponible.</p>`,
    );
  }

  private async sendNotificationForPVUploaded(notif: NotificationEntity) {
    const recipients = notif.recipients as string[];
    await this.mailService.sendSimpleMail(
      recipients[0],
      `PV disponible : ${notif.resourceId}`,
      `<p>Un nouveau Procès Verbal (PV) a été ajouté.</p>`,
    );
  }

  private async sendNotificationForQRUploaded(notif: NotificationEntity) {
    const recipients = notif.recipients as string[];
    await this.mailService.sendSimpleMail(
      recipients[0],
      `Réponse Q&R : ${notif.resourceId}`,
      `<p>Une nouvelle réponse Q&R pour ${notif.resourceId}.</p>`,
    );
  }

  private async sendNotificationForForgotPassword(notif: NotificationEntity) {
    const data = notif.data as any;
    const recipients = notif.recipients as string[];
    await this.mailService.sendConfirmation(
      recipients[0],
      data.token || 'reset-token',
    );
  }

  private async sendNotificationForDPACreated(notif: NotificationEntity) {
    const data = notif.data as any;
    const recipients = notif.recipients as string[];
    await this.mailService.sendSimpleMail(
      recipients[0],
      `DPA générée : ${data.reference || notif.resourceId}`,
      `<p>Une demande de paiement anticipé a été créée (${data.reference}).</p>`,
    );
  }
}
