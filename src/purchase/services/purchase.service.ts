import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowService } from './workflow.service';
import { WorkflowConfigService } from '../../purchaseValidation/services/workflow-config.service';
import { CreatePurchaseDto } from '../dto/create-purchase.dto';
import { AddPurchaseItemsDto } from '../dto/purchase-item.dto';
import { FilterPurchaseDto } from '../dto/filter-purchase.dto';
import { PurchaseStatus, PurchaseStep } from '@prisma/client';
import {
  buildPaginatedResponse,
  parsePaginationParams,
} from 'src/common/pagination.utils';

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
    private readonly workflowConfigService: WorkflowConfigService,
  ) {}

  async createPurchase(userId: number, createDto: CreatePurchaseDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouve');
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.purchase.count({
      where: { year },
    });
    const sequentialNumber = String(count + 1).padStart(4, '0');
    const reference = `DA-${year}-${sequentialNumber}`;

    const purchase = await this.prisma.purchase.create({
      data: {
        reference,
        year,
        sequentialNumber,
        ...createDto,
        status: PurchaseStatus.DRAFT,
        currentStep: PurchaseStep.DA,
        creatorId: userId,
      },
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: purchase.status,
      currentStep: purchase.currentStep,
      message: 'DA creee avec succes. Ajoutez maintenant les articles.',
    };
  }

  async addPurchaseItems(
    purchaseId: string,
    userId: number,
    itemsDto: AddPurchaseItemsDto,
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: true },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.creatorId !== userId) {
      throw new ForbiddenException(
        "Vous n'etes pas autorise a modifier cette DA",
      );
    }

    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException('Cette DA ne peut plus etre modifiee');
    }

    await this.prisma.purchaseItem.deleteMany({
      where: { purchaseId },
    });

    const items = await Promise.all(
      itemsDto.items.map((item) =>
        this.prisma.purchaseItem.create({
          data: {
            purchaseId,
            designation: item.designation,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
            unit: item.unit,
            specifications: item.specifications,
          },
        }),
      ),
    );

    return {
      purchaseId,
      items,
      message: 'Articles ajoutes avec succes',
    };
  }

  async publishPurchaseForValidation(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: true, validationWorkflow: true },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.creatorId !== userId) {
      throw new ForbiddenException(
        "Vous n'etes pas autorise a publier cette DA",
      );
    }

    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException('Cette DA a deja ete publiee');
    }

    if (purchase.items.length === 0) {
      throw new BadRequestException(
        'Ajoutez au moins un article avant de publier',
      );
    }

    // Determiner les validateurs selon le type d'operation et le montant
    const requiredRoles = this.workflowConfigService.getRequireValidators(
      purchase.currentStep,
      purchase.operationType,
      Number(purchase.amount),
    );

    // Recuperer l'utilisateur pour le premier validateur (DEMANDEUR)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // Creer le workflow de validation
    const workflow = await this.prisma.validationWorkflow.create({
      data: {
        purchaseId,
        currentStep: 0,
        validators: {
          create: requiredRoles.map((role, index) => ({
            role,
            order: index,
            userId: index === 0 ? userId : null,
            name: index === 0 ? user?.name : null,
            email: index === 0 ? user?.email : null,
            isValidated: index === 0, // Le demandeur valide automatiquement
            validatedAt: index === 0 ? new Date() : null,
            decision: index === 0 ? 'VALIDATED' : null,
          })),
        },
      },
      include: {
        validators: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Mettre a jour le statut de la purchase
    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        status: PurchaseStatus.PUBLISHED,
      },
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: PurchaseStatus.PUBLISHED,
      workflow: workflow.validators,
      message: 'DA publiee avec succes. En attente de validation.',
    };
  }

  /**
   * Recuperer une DA par ID
   */
  async getPurchaseById(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: true,
        attachments: true,
        derogation: true,
        validationWorkflow: {
          include: {
            validators: {
              orderBy: { order: 'asc' },
            },
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    return purchase;
  }

  /**
   * Recuperer les DA de l'utilisateur avec pagination centralisée
   */
  async getMyPurchases(userId: number, filters: FilterPurchaseDto = {}) {
    const pagination = parsePaginationParams(filters, {
      defaultPage: 1,
      defaultLimit: 10,
      maxLimit: 100,
    });

    // Construire les conditions where
    const where: any = { creatorId: userId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.currentStep) {
      where.currentStep = filters.currentStep;
    }

    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) {
        where.amount.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.amount.lte = filters.maxAmount;
      }
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Exécuter les requêtes
    const [purchases, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
          items: true,
          validationWorkflow: {
            include: {
              validators: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return buildPaginatedResponse(purchases, total, pagination);
  }

  async deleteDraftPurchase(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.creatorId !== userId) {
      throw new ForbiddenException(
        "Vous n'etes pas autorise a supprimer cette DA",
      );
    }

    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException(
        'Seules les DA en brouillon peuvent etre supprimees',
      );
    }

    await this.prisma.purchase.delete({
      where: { id: purchaseId },
    });

    return {
      message: 'DA supprimee avec succes',
    };
  }
}
