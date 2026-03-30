import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowService } from './workflow.service';
import { WorkflowConfigService } from '../../purchaseValidation/services/workflow-config.service';
import { PurchaseQueryService } from '../../purchaseValidation/services/purchase-query.service';
import { SubmitService } from './submit.service';
import { CreatePurchaseDto } from '../dto/create-purchase.dto';
import { AddPurchaseItemsDto } from '../dto/purchase-item.dto';
import { FilterPurchaseDto } from '../dto/filter-purchase.dto';
import { PurchaseStatus, PurchaseStep } from '@prisma/client';
import {
  buildPaginatedResponse,
  parsePaginationParams,
} from 'src/common/pagination.utils';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

// Ordre d'affichage des étapes dans le groupement
const STEP_ORDER: PurchaseStep[] = [
  PurchaseStep.DA,
  PurchaseStep.QR,
  PurchaseStep.PV,
  PurchaseStep.BC,
  PurchaseStep.BR,
  PurchaseStep.INVOICE,
  PurchaseStep.DAP,
  PurchaseStep.PROOF_OF_PAYMENT,
  PurchaseStep.DONE,
];

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
    private readonly workflowConfigService: WorkflowConfigService,
    private readonly purchaseQueryService: PurchaseQueryService,
    private readonly submitService: SubmitService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async createPurchase(userId: number, createDto: CreatePurchaseDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouve');

    const year = new Date().getFullYear();
    const count = await this.prisma.purchase.count({ where: { year } });
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

    this.logger.info('DA creee', {
      purchaseId: purchase.id,
      reference: purchase.reference,
      userId,
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

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (purchase.creatorId !== userId)
      throw new ForbiddenException(
        "Vous n'etes pas autorise a modifier cette DA",
      );
    if (
      purchase.status !== PurchaseStatus.DRAFT &&
      purchase.status !== PurchaseStatus.CHANGE_REQUESTED
    )
      throw new BadRequestException('Cette DA ne peut plus etre modifiee');

    await this.prisma.purchaseItem.deleteMany({ where: { purchaseId } });

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

    const cleanedItems = items.map((item) => {
      const cleaned: any = {
        id: item.id,
        designation: item.designation,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      };
      if (item.unit) cleaned.unit = item.unit;
      if (item.specifications) cleaned.specifications = item.specifications;
      return cleaned;
    });

    return {
      purchaseId,
      items: cleanedItems,
      message: 'Articles ajoutes avec succes',
    };
  }

  async publishPurchaseForValidation(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: true, validationWorkflows: true },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (purchase.creatorId !== userId)
      throw new ForbiddenException(
        "Vous n'etes pas autorise a publier cette DA",
      );
    if (
      purchase.status !== PurchaseStatus.DRAFT &&
      purchase.status !== PurchaseStatus.CHANGE_REQUESTED
    )
      throw new BadRequestException(
        'Seules les DA en brouillon ou avec modifications demandees peuvent etre publiees',
      );
    if (purchase.items.length === 0)
      throw new BadRequestException(
        'Ajoutez au moins un article avant de publier',
      );

    // Si la DA était en CHANGE_REQUESTED, on supprime les anciens workflows et on remet à zéro
    if (purchase.status === PurchaseStatus.CHANGE_REQUESTED) {
      await this.prisma.validationWorkflow.deleteMany({
        where: { purchaseId },
      });
      await this.prisma.purchase.update({
        where: { id: purchaseId },
        data: {
          observations: null,
          closedAt: null,
        },
      });
    }

    const totalAmount = purchase.items.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    const requiredRoles = this.workflowConfigService.getRequireValidators(
      purchase.currentStep,
      purchase.operationType,
      totalAmount,
    );

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const workflow = await this.prisma.validationWorkflow.create({
      data: {
        purchaseId,
        step: PurchaseStep.DA,
        currentStep: 1,
        validators: {
          create: requiredRoles.map((role, index) => ({
            role,
            order: index,
            userId: index === 0 ? userId : null,
            name: index === 0 ? user?.name : null,
            email: index === 0 ? user?.email : null,
            isValidated: index === 0,
            validatedAt: index === 0 ? new Date() : null,
            decision: index === 0 ? 'VALIDATED' : null,
          })),
        },
      },
      include: {
        validators: { orderBy: { order: 'asc' } },
      },
    });

    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: PurchaseStatus.PUBLISHED },
    });

    this.logger.info('DA publiee pour validation', {
      purchaseId: purchase.id,
      reference: purchase.reference,
      userId,
      validatorsCount: requiredRoles.length,
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: PurchaseStatus.PUBLISHED,
      workflow: workflow.validators,
      message: 'DA publiee avec succes. En attente de validation.',
    };
  }

  async getPurchaseById(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: true,
        attachments: true,
        derogation: true,
        validationWorkflows: {
          include: {
            validators: { orderBy: { order: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");

    const statusMessage = this.workflowConfigService.getStatusMessage(
      purchase.status,
      purchase.currentStep,
    );

    const cleanedItems = purchase.items.map((item) => {
      const cleaned: any = {
        id: item.id,
        designation: item.designation,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      };
      if (item.unit) cleaned.unit = item.unit;
      if (item.specifications) cleaned.specifications = item.specifications;
      return cleaned;
    });

    return {
      ...purchase,
      items: cleanedItems,
      amount: purchase.items.reduce((sum, item) => sum + item.amount, 0),
      statusMessage,
    };
  }

  // ─── Helpers privés ───────────────────────────────────────────────────────

  private buildPurchaseWhereClause(
    filters: FilterPurchaseDto,
    baseWhere: Record<string, any> = {},
  ): Record<string, any> {
    const where: any = { ...baseWhere };

    if (filters.status) where.status = filters.status;
    if (filters.currentStep) where.currentStep = filters.currentStep;
    if (filters.priority) where.priority = filters.priority;

    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      // On filtre sur le montant total via les items (agregat côté app après fetch)
      // Pour un filtrage SQL, on utilise une sous-requête via items
      where.items = {
        some: {},
      };
    }

    return where;
  }

  /** Groupe un tableau de DA par currentStep selon STEP_ORDER */
  private groupPurchasesByStep(purchases: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const step of STEP_ORDER) {
      const group = purchases.filter((p) => p.currentStep === step);
      if (group.length > 0) {
        grouped[step] = group;
      }
    }

    return grouped;
  }

  private enrichPurchases(purchases: any[]) {
    return purchases.map((purchase) => {
      const cleanedItems = purchase.items.map((item: any) => {
        const cleaned: any = {
          id: item.id,
          designation: item.designation,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        };
        if (item.unit) cleaned.unit = item.unit;
        if (item.specifications) cleaned.specifications = item.specifications;
        return cleaned;
      });

      return {
        ...purchase,
        items: cleanedItems,
        amount: purchase.items.reduce(
          (sum: number, item: any) => sum + item.amount,
          0,
        ),
        statusMessage: this.workflowConfigService.getStatusMessage(
          purchase.status,
          purchase.currentStep,
        ),
      };
    });
  }

  // ─── Méthodes publiques ───────────────────────────────────────────────────

  async getMyPurchases(userId: number, filters: FilterPurchaseDto = {}) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouve');

    const pagination = parsePaginationParams(filters, {
      defaultPage: 1,
      defaultLimit: 10,
      maxLimit: 100,
    });

    const where = this.buildPurchaseWhereClause(filters, {
      creatorId: userId,
    });

    const [purchases, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
          items: true,
          validationWorkflows: {
            include: {
              validators: { orderBy: { order: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [{ currentStep: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.purchase.count({ where }),
    ]);

    const enriched = this.enrichPurchases(purchases);

    return {
      grouped: this.groupPurchasesByStep(enriched),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async deleteDraftPurchase(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (purchase.creatorId !== userId)
      throw new ForbiddenException(
        "Vous n'etes pas autorise a supprimer cette DA",
      );
    if (purchase.status !== PurchaseStatus.DRAFT)
      throw new BadRequestException(
        'Seules les DA en brouillon peuvent etre supprimees',
      );

    await this.prisma.purchase.delete({ where: { id: purchaseId } });

    this.logger.info('DA supprimee', {
      purchaseId,
      reference: purchase.reference,
      userId,
    });

    return { message: 'DA supprimee avec succes' };
  }

  async updatePurchase(
    purchaseId: string,
    userId: number,
    updateDto: Partial<CreatePurchaseDto>,
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (purchase.creatorId !== userId)
      throw new ForbiddenException(
        "Vous n'etes pas autorise a modifier cette DA",
      );
    if (
      purchase.status !== PurchaseStatus.DRAFT &&
      purchase.status !== PurchaseStatus.CHANGE_REQUESTED
    )
      throw new BadRequestException('Cette DA ne peut plus etre modifiee');

    const updateData: any = { ...updateDto };

    if (!updateData.requestedDeliveryDate)
      delete updateData.requestedDeliveryDate;
    if (!updateData.deliveryAddress) delete updateData.deliveryAddress;

    const updated = await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: updateData,
    });

    return {
      id: updated.id,
      reference: updated.reference,
      status: updated.status,
      message: 'DA mise a jour avec succes',
    };
  }

  async updateLogistics(
    purchaseId: string,
    userId: number,
    dto: {
      deliveryAddress?: string;
      requestedDeliveryDate?: Date;
      observations?: string;
    },
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (purchase.creatorId !== userId)
      throw new ForbiddenException(
        "Vous n'etes pas autorise a modifier cette DA",
      );

    const updated = await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        ...(dto.deliveryAddress !== undefined && {
          deliveryAddress: dto.deliveryAddress,
        }),
        ...(dto.requestedDeliveryDate !== undefined && {
          requestedDeliveryDate: new Date(dto.requestedDeliveryDate),
        }),
        ...(dto.observations !== undefined && {
          observations: dto.observations,
        }),
      },
    });

    return {
      id: updated.id,
      reference: updated.reference,
      deliveryAddress: updated.deliveryAddress,
      requestedDeliveryDate: updated.requestedDeliveryDate,
      observations: updated.observations,
      message: 'Informations logistiques mises a jour avec succes',
    };
  }

  async updateAndRepublishPurchase(
    purchaseId: string,
    userId: number,
    updateDto: CreatePurchaseDto,
    itemsDto?: AddPurchaseItemsDto,
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { validationWorkflows: true },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (purchase.creatorId !== userId)
      throw new ForbiddenException(
        "Vous n'etes pas autorise a modifier cette DA",
      );
    if (purchase.status !== PurchaseStatus.CHANGE_REQUESTED)
      throw new BadRequestException(
        'Seules les DA avec modifications demandees peuvent etre republiees',
      );

    const updateData: any = {
      ...updateDto,
      status: PurchaseStatus.DRAFT,
      observations: null,
      closedAt: null,
    };

    if (!updateData.requestedDeliveryDate)
      delete updateData.requestedDeliveryDate;
    if (!updateData.deliveryAddress) delete updateData.deliveryAddress;

    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: updateData,
    });

    if (itemsDto) {
      await this.prisma.purchaseItem.deleteMany({ where: { purchaseId } });
      await Promise.all(
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
    }

    await this.prisma.validationWorkflow.deleteMany({ where: { purchaseId } });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: PurchaseStatus.DRAFT,
      message: 'DA modifiee avec succes. Vous pouvez maintenant la republier.',
    };
  }

  async getBuyerWorkspace(filters: FilterPurchaseDto = {}) {
    const pagination = parsePaginationParams(filters, {
      defaultPage: 1,
      defaultLimit: 10,
      maxLimit: 100,
    });

    const baseWhere: any = {
      status: {
        in: [
          PurchaseStatus.AWAITING_DOCUMENTS,
          PurchaseStatus.PENDING_APPROVAL,
          PurchaseStatus.IN_DEROGATION,
          PurchaseStatus.PUBLISHED,
        ],
      },
      // Si un filtre currentStep est précisé, il sera appliqué dans buildPurchaseWhereClause,
      // sinon on restreint aux étapes acheteur par défaut.
      ...(!filters.currentStep && {
        currentStep: {
          in: [
            PurchaseStep.QR,
            PurchaseStep.PV,
            PurchaseStep.BC,
            PurchaseStep.BR,
            PurchaseStep.INVOICE,
            PurchaseStep.DAP,
            PurchaseStep.PROOF_OF_PAYMENT,
          ],
        },
      }),
    };

    const where = this.buildPurchaseWhereClause(filters, baseWhere);

    const [purchases, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
          items: true,
          validationWorkflows: {
            include: {
              validators: { orderBy: { order: 'asc' } },
            },
          },
          creator: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        // Tri : d'abord par étape (ordre naturel enum), puis par date décroissante
        orderBy: [{ currentStep: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.purchase.count({ where }),
    ]);

    const enriched = this.enrichPurchases(purchases);

    return {
      grouped: this.groupPurchasesByStep(enriched),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getValidationStatus(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        validationWorkflows: {
          include: {
            validators: { orderBy: { order: 'asc' } },
          },
          orderBy: { step: 'asc' },
        },
      },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (purchase.creatorId !== userId)
      throw new ForbiddenException(
        'Seul le createur peut consulter le statut de validation',
      );

    return {
      id: purchase.id,
      reference: purchase.reference,
      currentStep: purchase.currentStep,
      status: purchase.status,
      validationWorkflows: purchase.validationWorkflows,
    };
  }

  async submitForValidation(purchaseId: string, userId: number) {
    return this.submitService.submitForValidation(purchaseId, userId);
  }
}
