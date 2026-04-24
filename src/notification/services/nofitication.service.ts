import { Injectable, Logger } from '@nestjs/common';
import {
  Notification as NotificationEntity,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RESEND_TEMPLATES } from 'src/resend/resend.constants';
import { NotificationRepository } from 'src/repository/notification/notification.repository';
import {
  NOTIFICATION_MAIL_QUEUE,
  OSDRM_PROCESS_EVENT,
  SEND_MAIL_JOB,
} from '../constants/notification.constants';
import { AuditService } from 'src/audit/services/audit.service';
import { PrismaService } from 'prisma/prisma.service';
import { SendMailJobData } from '../processors/notification-mail.processor';

const daysToMs = (days: number): number => days * 24 * 60 * 60 * 1000;

const MAIL_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: true,
  removeOnFail: false,
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly DEFAULT_REMINDER_INTERVAL_IN_DAYS = 1;
  private readonly enabledEvents: Set<string> | '*';

  constructor(
    private readonly repository: NotificationRepository,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(NOTIFICATION_MAIL_QUEUE) private readonly mailQueue: Queue,
  ) {
    const raw = this.config.get<string>('RESEND_ENABLED_EVENTS') ?? '*';
    this.enabledEvents =
      raw.trim() === '*'
        ? '*'
        : new Set(
            raw
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean),
          );

    this.logger.log(
      this.enabledEvents === '*'
        ? 'Envoi email activé pour tous les événements'
        : `Envoi email limité à : ${[...this.enabledEvents].join(', ')}`,
    );
  }

  private isEmailEnabled(eventType: string): boolean {
    return this.enabledEvents === '*' || this.enabledEvents.has(eventType);
  }

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
        const payload = this.buildMailPayload(notif);

        if (payload) {
          await this.mailQueue.add(SEND_MAIL_JOB, payload, MAIL_JOB_OPTIONS);
        }

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
        const payload = this.buildMailPayload(notif);

        if (payload) {
          await this.mailQueue.add(SEND_MAIL_JOB, payload, MAIL_JOB_OPTIONS);
        }

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
   * Construit le payload du job d'envoi d'email selon le type de notification.
   * Retourne null si l'envoi est désactivé ou si aucun destinataire n'est trouvé.
   */
  private buildMailPayload(notif: NotificationEntity): SendMailJobData | null {
    if (!this.isEmailEnabled(notif.type)) {
      this.logger.debug(
        `[SKIP] Envoi email désactivé pour l'événement : ${notif.type}`,
      );
      return null;
    }

    const recipients = notif.recipients as string[];
    const to = recipients[0];
    if (!to) return null;

    const data = notif.data as any;
    const ref = data.reference || notif.resourceId;
    const isReminder = notif.status === NotificationStatus.SENT;

    switch (notif.type) {
      case OSDRM_PROCESS_EVENT.DA_CREATED:
        return {
          to,
          subject: `${isReminder ? '[RAPPEL] ' : ''}Validation requise : DA ${ref}`,
          template: RESEND_TEMPLATES.DA_CREATED,
          variables: {
            isReminder,
            reference: ref,
            demandeur: data.demandeur,
            montant: data.montant,
          },
        };

      case OSDRM_PROCESS_EVENT.BC_UPLOADED:
        return {
          to,
          subject: `${isReminder ? '[RAPPEL] ' : ''}Validation BC requise : ${ref}`,
          template: RESEND_TEMPLATES.BC_UPLOADED,
          variables: {
            isReminder,
            reference: ref,
            fournisseur: data.fournisseur,
            montant: data.montant,
          },
        };

      case OSDRM_PROCESS_EVENT.PV_UPLOADED:
        return {
          to,
          subject: `${isReminder ? '[RAPPEL] ' : ''}Signature PV requise : ${ref}`,
          template: RESEND_TEMPLATES.PV_UPLOADED,
          variables: {
            isReminder,
            reference: ref,
            fournisseur: data.fournisseur,
          },
        };

      case OSDRM_PROCESS_EVENT.QR_UPLOADED:
        return {
          to,
          subject: `${isReminder ? '[RAPPEL] ' : ''}Réponse Q&R en attente : ${ref}`,
          template: RESEND_TEMPLATES.QR_UPLOADED,
          variables: {
            isReminder,
            reference: ref,
            fournisseur: data.fournisseur,
          },
        };

      case OSDRM_PROCESS_EVENT.DAP_CREATED:
        return {
          to,
          subject: `${isReminder ? '[RAPPEL] ' : ''}Validation DAP requise : ${ref}`,
          template: RESEND_TEMPLATES.DAP_CREATED,
          variables: {
            isReminder,
            reference: ref,
            montant: data.montant,
          },
        };

      case OSDRM_PROCESS_EVENT.PURCHASE_COMMENT_ADDED: {
        const commentFrontendUrl =
          this.config.get<string>('FRONTEND_URL') ??
          this.config.get<string>('RESEND_FRONTEND_URL') ??
          'http://localhost:5173';
        return {
          to,
          subject: `Nouveau commentaire sur la DA ${ref}`,
          template: RESEND_TEMPLATES.PURCHASE_COMMENT_ADDED,
          variables: {
            reference: ref,
            purchaseTitle: data.purchaseTitle,
            authorName: data.authorName,
            currentStep: data.currentStep,
            commentExcerpt: data.commentExcerpt,
            purchaseUrl: `${commentFrontendUrl}/achats/${data.purchaseId}`,
          },
        };
      }

      case OSDRM_PROCESS_EVENT.FORGOT_PASSWORD: {
        const frontendUrl =
          this.config.get<string>('RESEND_FRONTEND_URL') ??
          'http://localhost:5173';
        return {
          to,
          subject: 'Réinitialisation de votre mot de passe',
          template: RESEND_TEMPLATES.CONFIRMATION,
          variables: {
            link: `${frontendUrl}/reset-password?token=${data.token ?? 'reset-token'}`,
          },
        };
      }

      case OSDRM_PROCESS_EVENT.VEHICLE_DOCUMENT_EXPIRY_ALERT:
        return null;

      default:
        throw new Error(`Type d'évènement non supporté : ${notif.type}`);
    }
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

    this.auditService.log({
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
