import { Injectable } from '@nestjs/common';
import {
  Notification as NotificationEntity,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { GetNotificationsQueryDto } from 'src/notification/dto/get-notifications-query.dto';

const DISPLAYED_NOTIFICATION_TYPES = [
  'DA_CREATED',
  'BC_UPLOADED',
  'PV_UPLOADED',
  'QR_UPLOADED',
  'DAP_CREATED',
  'PURCHASE_COMMENT_ADDED',
] as const;

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
   * Récupère les notifications paginées pour l'API publique
   */
  async findPaginated(filters: GetNotificationsQueryDto) {
    const { page = 1, limit = 20, type, status, startDate, endDate } = filters;

    const allowedType =
      type && (DISPLAYED_NOTIFICATION_TYPES as readonly string[]).includes(type)
        ? type
        : undefined;

    const where: Prisma.NotificationWhereInput = {
      type: allowedType
        ? allowedType
        : { in: [...DISPLAYED_NOTIFICATION_TYPES] },
      ...(status && { status }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
    -- Filtre critique : On ne prend que ce qui n'est pas encore expiré
    -- (Une fois validé, expiredAt <= now, donc la ligne sort du flux)
    AND ("expiredAt" > ${now} OR "expiredAt" IS NULL)
    AND "lastSentAt" + (CAST(COALESCE("reminderIntervalInDays", ${interval}) AS INTEGER) * INTERVAL '1 day') <= ${now}
  `;
  }
}
