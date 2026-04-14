import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PurchaseStep } from '@prisma/client';

@Injectable()
export class CommentRepository {
  constructor(private prisma: PrismaService) {}

  private readonly authorSelect = {
    id: true,
    name: true,
    role: true,
  };

  /**
   * Crée un commentaire sur un achat
   */
  async create(data: {
    purchaseId: string;
    authorId: number;
    content: string;
    currentStep: PurchaseStep;
  }) {
    return this.prisma.purchaseComment.create({
      data: {
        purchaseId: data.purchaseId,
        authorId: data.authorId,
        content: data.content,
        currentStep: data.currentStep,
      },
      include: {
        author: { select: this.authorSelect },
      },
    });
  }

  /**
   * Récupère les commentaires paginés pour un achat
   */
  async findPaginated(purchaseId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.purchaseComment.findMany({
        where: { purchaseId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: this.authorSelect },
        },
      }),
      this.prisma.purchaseComment.count({ where: { purchaseId } }),
    ]);

    return { data, total };
  }
}
