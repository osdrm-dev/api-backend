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
   * Arrête les relances pour un utilisateur spécifique sur une ressource.
   * On ne change pas le statut 'SENT' pour garder l'historique,
   * on joue uniquement sur la date d'expiration.
   */
  async stopActiveReminders(resourceId: string, email: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        resourceId: resourceId,
        status: 'SENT',
        recipients: {
          array_contains: email,
        },
      },
      data: {
        // Le "bouton OFF" : expiredAt devient maintenant
        expiredAt: new Date(),
      },
    });
  }

  /**
   * Aiguilleur central pour l'envoi de mail
   */
  private async dispatchNotification(notif: NotificationEntity) {
    const recipients = notif.recipients as string[];
    const targetEmail = recipients[0];

    if (!targetEmail) return;

    const isReminder = notif.status === NotificationStatus.SENT;

    switch (notif.type) {
      case OSDRM_PROCESS_EVENT.DA_CREATED:
        await this.sendNotificationForDACreated(notif, targetEmail, isReminder);
        break;
      case OSDRM_PROCESS_EVENT.BC_UPLOADED:
        await this.sendNotificationForBCUploaded(
          notif,
          targetEmail,
          isReminder,
        );
        break;
      case OSDRM_PROCESS_EVENT.PV_UPLOADED:
        await this.sendNotificationForPVUploaded(
          notif,
          targetEmail,
          isReminder,
        );
        break;
      case OSDRM_PROCESS_EVENT.QR_UPLOADED:
        await this.sendNotificationForQRUploaded(
          notif,
          targetEmail,
          isReminder,
        );
        break;
      case OSDRM_PROCESS_EVENT.FORGOT_PASSWORD:
        await this.sendNotificationForForgotPassword(notif, targetEmail);
        break;
      case OSDRM_PROCESS_EVENT.DPA_CREATED:
        await this.sendNotificationForDPACreated(
          notif,
          targetEmail,
          isReminder,
        );
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
  private async sendNotificationForDACreated(
    notif: NotificationEntity,
    email: string,
    isReminder: boolean,
  ) {
    const data = notif.data as any;
    const subject = isReminder
      ? `[RAPPEL] Validation requise : ${data.reference}`
      : `Nouvelle DA à valider : ${data.reference}`;

    await this.mailService.sendSimpleMail(
      email,
      subject,
      `<p>${isReminder ? 'Rappel : ' : ''}Une demande d'achat attend votre validation.</p>`,
    );
  }

  private async sendNotificationForBCUploaded(
    notif: NotificationEntity,
    email: string,
    isReminder: boolean,
  ) {
    const data = notif.data as any;
    const subject = isReminder
      ? `[RAPPEL] Validation BC requise : ${data.reference || notif.resourceId}`
      : `Bon de Commande (BC) déposé : ${data.reference || notif.resourceId}`;

    await this.mailService.sendSimpleMail(
      email,
      subject,
      `<p>Bonjour,</p><p>${isReminder ? 'Ceci est un rappel : ' : ''}Le Bon de Commande pour la référence <strong>${data.reference || notif.resourceId}</strong> est disponible et attend votre validation.</p>`,
    );
  }

  private async sendNotificationForPVUploaded(
    notif: NotificationEntity,
    email: string,
    isReminder: boolean,
  ) {
    const data = notif.data as any;
    const subject = isReminder
      ? `[RAPPEL] Validation PV requise : ${data.reference || notif.resourceId}`
      : `Procès Verbal (PV) disponible : ${data.reference || notif.resourceId}`;

    await this.mailService.sendSimpleMail(
      email,
      subject,
      `<p>Bonjour,</p><p>${isReminder ? 'Ceci est un rappel : ' : ''}Un nouveau Procès Verbal (PV) a été ajouté pour la demande <strong>${data.reference || notif.resourceId}</strong>.</p>`,
    );
  }

  private async sendNotificationForQRUploaded(
    notif: NotificationEntity,
    email: string,
    isReminder: boolean,
  ) {
    const data = notif.data as any;
    const subject = isReminder
      ? `[RAPPEL] Réponse Q&R en attente : ${data.reference || notif.resourceId}`
      : `Nouvelle réponse Q&R : ${data.reference || notif.resourceId}`;

    await this.mailService.sendSimpleMail(
      email,
      subject,
      `<p>Bonjour,</p><p>${isReminder ? 'Ceci est un rappel : ' : ''}Une mise à jour concernant les Questions/Réponses de la demande <strong>${data.reference || notif.resourceId}</strong> est disponible.</p>`,
    );
  }

  private async sendNotificationForDPACreated(
    notif: NotificationEntity,
    email: string,
    isReminder: boolean,
  ) {
    const data = notif.data as any;
    const subject = isReminder
      ? `[RAPPEL] Validation DPA requise : ${data.reference || notif.resourceId}`
      : `Demande de Paiement Anticipé (DPA) générée : ${data.reference || notif.resourceId}`;

    await this.mailService.sendSimpleMail(
      email,
      subject,
      `<p>Bonjour,</p><p>${isReminder ? 'Ceci est un rappel : ' : ''}Une demande de paiement anticipé a été créée pour la référence <strong>${data.reference || notif.resourceId}</strong>.</p>`,
    );
  }

  private async sendNotificationForForgotPassword(
    notif: NotificationEntity,
    email: string,
  ) {
    const data = notif.data as any;
    await this.mailService.sendConfirmation(email, data.token || 'reset-token');
  }
}
