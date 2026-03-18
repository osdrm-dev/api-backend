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
   * Crée une notification initiale
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
   * CONSIGNE LEAD : Arrête les relances actives pour un utilisateur sur une ressource.
   * On joue uniquement sur expiredAt pour sortir la notification du flux du Cron.
   */
  async stopActiveReminders(resourceId: string, email: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        resourceId: resourceId,
        status: NotificationStatus.SENT,
        recipients: {
          array_contains: email,
        },
      },
      data: {
        expiredAt: new Date(),
      },
    });
    this.logger.log(
      `Relances stoppées (expiration) pour ${email} sur ${resourceId}`,
    );
  }

  /**
   * Cycle 1 : Envoi initial
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
   * Cycle 2 : Envoi des rappels (Cron)
   */
  async processReminders() {
    const now = new Date();
    const notificationsToRemind = await this.repository.findEligibleForReminder(
      now,
      this.DEFAULT_REMINDER_INTERVAL_IN_DAYS,
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
      } catch (error) {
        await this.handleError(notif, error);
      }
    }
  }

  /**
   * Aiguilleur central : Détermine si c'est un rappel et oriente vers le bon template
   */
  private async dispatchNotification(notif: NotificationEntity) {
    const recipients = notif.recipients as string[];
    const targetEmail = recipients[0];
    if (!targetEmail) return;

    // Si status est déjà SENT, c'est que le processReminder l'a récupéré -> c'est un rappel
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
      case OSDRM_PROCESS_EVENT.DPA_CREATED:
        await this.sendNotificationForDPACreated(
          notif,
          targetEmail,
          isReminder,
        );
        break;
      case OSDRM_PROCESS_EVENT.FORGOT_PASSWORD:
        await this.sendNotificationForForgotPassword(notif, targetEmail);
        break;
      default:
        throw new Error(`Type d'évènement non supporté : ${notif.type}`);
    }
  }

  // --- Templates d'envoi ---

  private async sendNotificationForDACreated(
    notif: NotificationEntity,
    email: string,
    isReminder: boolean,
  ) {
    const data = notif.data as any;
    const subject = `${isReminder ? '[RAPPEL] ' : ''}Validation requise : DA ${data.reference || ''}`;

    await this.mailService.sendSimpleMail(
      email,
      subject,
      `<p>${isReminder ? 'Rappel : ' : ''}Une demande d'achat attend votre validation.</p><ul><li>Référence : ${data.reference}</li></ul>`,
    );
  }

  private async sendNotificationForBCUploaded(
    notif: NotificationEntity,
    email: string,
    isReminder: boolean,
  ) {
    const data = notif.data as any;
    const subject = `${isReminder ? '[RAPPEL] ' : ''}Validation BC requise : ${data.reference || notif.resourceId}`;

    await this.mailService.sendSimpleMail(
      email,
      subject,
      `<p>${isReminder ? 'Ceci est un rappel : ' : ''}Le Bon de Commande pour la référence <strong>${data.reference || notif.resourceId}</strong> est disponible.</p>`,
    );
  }

  private async sendNotificationForPVUploaded(
    notif: NotificationEntity,
    email: string,
    isReminder: boolean,
  ) {
    const data = notif.data as any;
    const subject = `${isReminder ? '[RAPPEL] ' : ''}Signature PV requise : ${data.reference || notif.resourceId}`;

    await this.mailService.sendSimpleMail(
      email,
      subject,
      `<p>${isReminder ? 'Ceci est un rappel : ' : ''}Un nouveau Procès Verbal (PV) attend votre signature pour la demande <strong>${data.reference || notif.resourceId}</strong>.</p>`,
    );
  }

  private async sendNotificationForQRUploaded(
    notif: NotificationEntity,
    email: string,
    isReminder: boolean,
  ) {
    const data = notif.data as any;
    const subject = `${isReminder ? '[RAPPEL] ' : ''}Réponse Q&R en attente : ${data.reference || notif.resourceId}`;

    await this.mailService.sendSimpleMail(
      email,
      subject,
      `<p>${isReminder ? 'Ceci est un rappel : ' : ''}Une mise à jour Q&R pour la demande <strong>${data.reference || notif.resourceId}</strong> nécessite votre attention.</p>`,
    );
  }

  private async sendNotificationForDPACreated(
    notif: NotificationEntity,
    email: string,
    isReminder: boolean,
  ) {
    const data = notif.data as any;
    const subject = `${isReminder ? '[RAPPEL] ' : ''}Validation DPA requise : ${data.reference || notif.resourceId}`;

    await this.mailService.sendSimpleMail(
      email,
      subject,
      `<p>${isReminder ? 'Ceci est un rappel : ' : ''}Une demande de paiement anticipé (${data.reference}) attend votre validation.</p>`,
    );
  }

  private async sendNotificationForForgotPassword(
    notif: NotificationEntity,
    email: string,
  ) {
    const data = notif.data as any;
    await this.mailService.sendConfirmation(email, data.token || 'reset-token');
  }

  // --- Outils internes ---

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
      details: { type: notif.type, attempts: notif.attemptCount },
    });
  }

  private async handleError(notif: NotificationEntity, error: any) {
    this.logger.error(`Erreur sur notif ${notif.id}: ${error.message}`);
    await this.prisma.notification.update({
      where: { id: notif.id },
      data: { attemptCount: { increment: 1 } },
    });
  }
}
