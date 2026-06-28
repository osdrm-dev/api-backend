import { ForbiddenException, Injectable } from '@nestjs/common';
import { CommentEntityType, LgComment, PurchaseStep } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

interface CreateCommentData {
  entityType: CommentEntityType;
  entityId: string;
  authorId: number;
  content: string;
  currentStep?: PurchaseStep | null;
}

@Injectable()
export class UnifiedCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly authorSelect = {
    id: true,
    name: true,
    role: true,
  };

  /**
   * Crée un commentaire polymorphique pour n'importe quel type d'entité.
   */
  async create(data: CreateCommentData) {
    return this.prisma.lgComment.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        authorId: data.authorId,
        content: data.content,
        currentStep: data.currentStep ?? null,
      },
      include: {
        author: { select: this.authorSelect },
      },
    });
  }

  /**
   * Récupère les commentaires paginés d'une entité (non supprimés),
   * triés du plus récent au plus ancien.
   */
  async findPaginated(
    entityType: CommentEntityType,
    entityId: string,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;
    const where = { entityType, entityId, deletedAt: null };

    const [data, total] = await Promise.all([
      this.prisma.lgComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: this.authorSelect },
        },
      }),
      this.prisma.lgComment.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Soft-delete d'un commentaire. Seul un ADMIN ou l'auteur peut supprimer.
   */
  async softDelete(
    id: string,
    requestorId: number,
    isAdmin: boolean,
  ): Promise<void> {
    if (!isAdmin) {
      const comment = await this.prisma.lgComment.findUnique({
        where: { id },
        select: { authorId: true },
      });

      if (!comment || comment.authorId !== requestorId) {
        throw new ForbiddenException(
          'Vous ne pouvez supprimer que vos propres commentaires.',
        );
      }
    }

    await this.prisma.lgComment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Compte les commentaires non supprimés pour un lot d'entités du même type.
   * Retourne une map entityId → nombre de commentaires.
   * Évite les requêtes N+1 sur les endpoints de liste.
   */
  async countByEntityIds(
    entityType: CommentEntityType,
    entityIds: string[],
  ): Promise<Record<string, number>> {
    if (entityIds.length === 0) {
      return {};
    }

    const rows = await this.prisma.lgComment.groupBy({
      by: ['entityId'],
      where: {
        entityType,
        entityId: { in: entityIds },
        deletedAt: null,
      },
      _count: { id: true },
    });

    return Object.fromEntries(rows.map((r) => [r.entityId, r._count.id]));
  }
}

export type LgCommentWithAuthor = LgComment & {
  author: { id: number; name: string; role: string } | null;
};
