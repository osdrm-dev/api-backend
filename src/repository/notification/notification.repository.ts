import { Injectable } from '@nestjs/common';
import { NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class NotificationRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Récupère les notifications à traiter
   */
  async findAllPending(limit: number = 50) {
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
}
