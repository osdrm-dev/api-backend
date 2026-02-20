import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PurchaseStatus, Role } from '@prisma/client';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPurchaseCount(user: { id: number; role: Role }) {
    let totalCount: number;
    let validatedCount: number;
    let totalBudget: number;
    let validatedBudget: number;
    let highestPriorityPurchase: any;

    if (user.role === Role.ADMIN) {
      totalCount = await this.prisma.purchase.count();

      validatedCount = await this.prisma.purchase.count({
        where: { NOT: { status: PurchaseStatus.VALIDATED } },
      });

      const items = await this.prisma.purchaseItem.findMany({
        select: { amount: true },
      });
      totalBudget = items.reduce((sum, item) => sum + item.amount, 0);

      const validatedItems = await this.prisma.purchaseItem.findMany({
        where: { purchase: { status: PurchaseStatus.VALIDATED } },
        select: { amount: true },
      });
      validatedBudget = validatedItems.reduce(
        (sum, item) => sum + item.amount,
        0,
      );

      highestPriorityPurchase = await this.prisma.purchase.findFirst({
        where: { priority: 'TRES_URGENT' },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      totalCount = await this.prisma.purchase.count({
        where: { creatorId: user.id },
      });

      validatedCount = await this.prisma.purchase.count({
        where: {
          creatorId: user.id,
          NOT: { status: PurchaseStatus.VALIDATED },
        },
      });

      const items = await this.prisma.purchaseItem.findMany({
        where: { purchase: { creatorId: user.id } },
        select: { amount: true },
      });
      totalBudget = items.reduce((sum, item) => sum + item.amount, 0);

      const validatedItems = await this.prisma.purchaseItem.findMany({
        where: {
          purchase: { creatorId: user.id, status: PurchaseStatus.VALIDATED },
        },
        select: { amount: true },
      });
      validatedBudget = validatedItems.reduce(
        (sum, item) => sum + item.amount,
        0,
      );

      highestPriorityPurchase = await this.prisma.purchase.findFirst({
        where: { creatorId: user.id, priority: 'TRES_URGENT' },
        orderBy: { createdAt: 'desc' },
      });
    }

    return {
      totalPurchases: totalCount,
      totalValidatedPurchases: validatedCount,
      totalBudget,
      validatedBudget,
      highestPriorityPurchase,
    };
  }
}
