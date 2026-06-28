import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommentEntityType, PurchaseStep } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import {
  LgCommentWithAuthor,
  UnifiedCommentRepository,
} from 'src/repository/comment/unified-comment.repository';

interface CreateCommentDto {
  content: string;
  currentStep?: PurchaseStep | null;
}

@Injectable()
export class UnifiedCommentService {
  private readonly logger = new Logger(UnifiedCommentService.name);

  constructor(
    private readonly repository: UnifiedCommentRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Crée un commentaire polymorphique pour une entité donnée.
   * Valide l'existence de l'entité, puis (pour les achats uniquement)
   * déclenche la notification PURCHASE_COMMENT_ADDED.
   */
  async create(
    entityType: CommentEntityType,
    entityId: string,
    authorId: number,
    dto: CreateCommentDto,
  ) {
    await this.validateEntityExists(entityType, entityId);

    // Pour les achats, on capture l'étape courante du workflow au moment du
    // commentaire (sauf si explicitement fournie dans le DTO).
    let currentStep = dto.currentStep ?? null;
    if (entityType === CommentEntityType.PURCHASE && currentStep === null) {
      const purchase = await this.prisma.purchase.findUnique({
        where: { id: entityId },
        select: { currentStep: true },
      });
      currentStep = purchase?.currentStep ?? null;
    }

    const comment = await this.repository.create({
      entityType,
      entityId,
      authorId,
      content: dto.content,
      currentStep,
    });

    await this.maybeFireNotification(entityType, entityId, comment);

    return comment;
  }

  /**
   * Récupère les commentaires paginés (non supprimés) d'une entité.
   */
  async findPaginated(
    entityType: CommentEntityType,
    entityId: string,
    page: number,
    limit: number,
  ) {
    const { data, total } = await this.repository.findPaginated(
      entityType,
      entityId,
      page,
      limit,
    );

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
   * Soft-delete d'un commentaire (ADMIN ou auteur uniquement).
   */
  async delete(id: string, requestorId: number, isAdmin: boolean) {
    await this.repository.softDelete(id, requestorId, isAdmin);
  }

  /**
   * Vérifie l'existence (et la non-suppression) de l'entité parente.
   * Lève une 404 si l'entité est introuvable ou soft-deletée.
   */
  private async validateEntityExists(
    entityType: CommentEntityType,
    entityId: string,
  ): Promise<void> {
    let exists: { id: string } | null = null;

    switch (entityType) {
      case CommentEntityType.PURCHASE:
        // Le modèle Purchase n'a pas de soft-delete (deletedAt).
        exists = await this.prisma.purchase.findFirst({
          where: { id: entityId },
          select: { id: true },
        });
        break;
      case CommentEntityType.MAINTENANCE:
        exists = await this.prisma.maintenanceRequest.findFirst({
          where: { id: entityId, deletedAt: null },
          select: { id: true },
        });
        break;
      case CommentEntityType.DEPLACEMENT:
        exists = await this.prisma.lgDeplacement.findFirst({
          where: { id: entityId, deletedAt: null },
          select: { id: true },
        });
        break;
      case CommentEntityType.TRIP:
        exists = await this.prisma.lgTrip.findFirst({
          where: { id: entityId, deletedAt: null },
          select: { id: true },
        });
        break;
      case CommentEntityType.CARBURANT:
        exists = await this.prisma.lgCarburant.findFirst({
          where: { id: entityId, deletedAt: null },
          select: { id: true },
        });
        break;
    }

    if (!exists) {
      throw new NotFoundException('Entité introuvable.');
    }
  }

  /**
   * Déclenche la notification de commentaire — uniquement pour les achats.
   * Reproduit la logique de l'ancien CommentService (achat).
   */
  private async maybeFireNotification(
    entityType: CommentEntityType,
    entityId: string,
    comment: LgCommentWithAuthor,
  ): Promise<void> {
    if (entityType !== CommentEntityType.PURCHASE) {
      return;
    }

    try {
      const purchase = await this.prisma.purchase.findUnique({
        where: { id: entityId },
        include: {
          creator: {
            select: { id: true, email: true, name: true },
          },
          validationWorkflows: {
            include: {
              validators: {
                select: { email: true },
              },
            },
          },
        },
      });

      if (!purchase) {
        return;
      }

      const recipients = await this.resolveRecipients(
        purchase,
        comment.authorId,
      );

      if (recipients.length === 0) {
        return;
      }

      const commentExcerpt =
        comment.content.length > 120
          ? comment.content.substring(0, 120) + '...'
          : comment.content;

      const authorName = comment.author?.name ?? 'Utilisateur supprimé';

      await this.notificationService.createNotification(
        OSDRM_PROCESS_EVENT.PURCHASE_COMMENT_ADDED,
        recipients,
        entityId,
        {
          reference: purchase.reference,
          purchaseTitle: purchase.title,
          purchaseId: purchase.id,
          authorName,
          currentStep: purchase.currentStep,
          commentExcerpt,
        },
        false, // hasReminder
        new Date(Date.now() + 24 * 60 * 60 * 1000), // expiredAt: 24h
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de la notification de commentaire: ${error.message}`,
      );
    }
  }

  /**
   * Résout les destinataires de la notification de commentaire d'achat.
   * Créateur du DA + validateurs + ADMIN/ACHETEUR actifs, hors auteur.
   */
  private async resolveRecipients(
    purchase: {
      creator?: { id: number; email: string } | null;
      validationWorkflows: Array<{
        validators: Array<{ email: string | null }>;
      }>;
    },
    authorId: number | null,
  ): Promise<string[]> {
    const emailSet = new Set<string>();

    if (purchase.creator?.email) {
      emailSet.add(purchase.creator.email);
    }

    for (const workflow of purchase.validationWorkflows) {
      for (const validator of workflow.validators) {
        if (validator.email) {
          emailSet.add(validator.email);
        }
      }
    }

    const adminAndAcheteur = await this.prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'ACHETEUR'] },
        isActive: true,
      },
      select: { email: true },
    });

    for (const user of adminAndAcheteur) {
      if (user.email) {
        emailSet.add(user.email);
      }
    }

    if (authorId !== null) {
      const author = await this.prisma.user.findUnique({
        where: { id: authorId },
        select: { email: true },
      });

      if (author?.email) {
        emailSet.delete(author.email);
      }
    }

    return Array.from(emailSet);
  }
}
