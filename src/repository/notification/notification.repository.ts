import { Injectable } from '@nestjs/common';
import {
  Notification as NotificationEntity,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class NotificationRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Récupère les notifications à traiter
   */
  async findAllPending(limit: number = 10) {
    return this.prisma.notification.findMany({
      where: { status: 'PENDING' },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Met à jour une notification après traitement
   */
  async updateStatusAfterSend(id: string, status: NotificationStatus) {
    return this.prisma.notification.update({
      where: { id },
      data: {
        status: status,
        lastSentAt: status === NotificationStatus.SENT ? new Date() : undefined,
        attemptCount: { increment: 1 },
      },
    });
  }

  /**
   * Pour ton service métier (création)
   */
  async create(data: Prisma.NotificationCreateInput) {
    return this.prisma.notification.create({ data });
  }

  /**
   * Récupère uniquement les notifications
   */
  async findEligibleForReminder(
    now: Date,
    defaultInterval: number,
  ): Promise<NotificationEntity[]> {
    const interval = Number(defaultInterval);

    return await this.prisma.$queryRaw<NotificationEntity[]>`
    SELECT * FROM "notifications"
    WHERE "status" = 'SENT'
    AND "hasReminder" = true
    AND "lastSentAt" IS NOT NULL
    AND "lastSentAt" + (CAST(COALESCE("reminderIntervalInDays", ${interval}) AS INTEGER) * INTERVAL '1 day') <= ${now}
    AND "expiredAt" > ${now}
  `;
  }
}
