import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CommentRepository } from 'src/repository/purchase/comment.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { CreateCommentDto } from '../dto/create-comment.dto';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commentRepository: CommentRepository,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Récupère les commentaires paginés pour un achat
   */
  async findByPurchase(purchaseId: string, page: number, limit: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      select: { id: true },
    });

    if (!purchase) {
      throw new NotFoundException('Achat non trouvé');
    }

    const { data, total } = await this.commentRepository.findPaginated(
      purchaseId,
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
   * Crée un commentaire sur un achat et envoie les notifications
   */
  async create(purchaseId: string, authorId: number, dto: CreateCommentDto) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
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
      throw new NotFoundException('Achat non trouvé');
    }

    const comment = await this.commentRepository.create({
      purchaseId,
      authorId,
      content: dto.content,
      currentStep: purchase.currentStep,
    });

    // Résolution des destinataires et envoi de la notification
    try {
      const recipients = await this.resolveRecipients(purchase, authorId);

      if (recipients.length > 0) {
        const commentExcerpt =
          dto.content.length > 120
            ? dto.content.substring(0, 120) + '...'
            : dto.content;

        const authorName = comment.author?.name ?? 'Utilisateur supprimé';

        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.PURCHASE_COMMENT_ADDED,
          recipients,
          purchaseId,
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
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de la notification de commentaire: ${error.message}`,
      );
    }

    return comment;
  }

  /**
   * Résout les destinataires de la notification de commentaire.
   * Collecte: créateur du DA + tous les validateurs + ADMIN + ACHETEUR actifs.
   * Exclut l'auteur du commentaire.
   */
  private async resolveRecipients(
    purchase: {
      creator?: { id: number; email: string } | null;
      validationWorkflows: Array<{
        validators: Array<{ email: string | null }>;
      }>;
    },
    authorId: number,
  ): Promise<string[]> {
    const emailSet = new Set<string>();

    // 1. Email du créateur
    if (purchase.creator?.email) {
      emailSet.add(purchase.creator.email);
    }

    // 2. Emails de tous les validateurs
    for (const workflow of purchase.validationWorkflows) {
      for (const validator of workflow.validators) {
        if (validator.email) {
          emailSet.add(validator.email);
        }
      }
    }

    // 3. Emails des ADMIN et ACHETEUR actifs
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

    // 4. Exclure l'email de l'auteur du commentaire
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { email: true },
    });

    if (author?.email) {
      emailSet.delete(author.email);
    }

    return Array.from(emailSet);
  }
}
