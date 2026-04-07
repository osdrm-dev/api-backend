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
import { PurchaseStatus, PurchaseStep, AttachmentType } from '@prisma/client';
import {
  buildPaginatedResponse,
  parsePaginationParams,
} from 'src/common/pagination.utils';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

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

    // Extraire les attachments du DTO
    const { attachments, ...purchaseData } = createDto;

    const purchase = await this.prisma.purchase.create({
      data: {
        reference,
        year,
        sequentialNumber,
        ...purchaseData,
        status: PurchaseStatus.DRAFT,
        currentStep: PurchaseStep.DA,
        creatorId: userId,
        // Créer les attachments si fournis
        ...(attachments &&
          attachments.length > 0 && {
            attachments: {
              create: attachments.map((att) => ({
                type: AttachmentType.DA_ATTACHMENT, // Pièces jointes de la DA
                fileName: att.fileName,
                fileUrl: att.fileUrl,
                fileId: att.fileId,
                fileSize: att.fileSize,
                mimeType: att.mimeType,
                description: att.description,
                uploadedBy: user.name,
              })),
            },
          }),
      },
      include: {
        attachments: true,
      },
    });

    this.logger.info('DA creee', {
      purchaseId: purchase.id,
      reference: purchase.reference,
      userId,
      attachmentsCount: purchase.attachments.length,
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: purchase.status,
      currentStep: purchase.currentStep,
      attachments: purchase.attachments,
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

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Extraire les attachments du DTO
    const { attachments, ...updateData } = updateDto;

    if (!updateData.requestedDeliveryDate)
      delete updateData.requestedDeliveryDate;
    if (!updateData.deliveryAddress) delete updateData.deliveryAddress;

    // Si des attachments sont fournis, on les ajoute (sans supprimer les anciens)
    if (attachments && attachments.length > 0) {
      await this.prisma.attachment.createMany({
        data: attachments.map((att) => ({
          purchaseId,
          type: AttachmentType.DA_ATTACHMENT, // Pièces jointes de la DA
          fileName: att.fileName,
          fileUrl: att.fileUrl,
          fileId: att.fileId,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          description: att.description,
          uploadedBy: user?.name,
        })),
      });
    }

    const updated = await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: updateData,
      include: {
        attachments: true,
      },
    });

    return {
      id: updated.id,
      reference: updated.reference,
      status: updated.status,
      attachments: updated.attachments,
      message: 'DA mise a jour avec succes',
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
      statusMessage,
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

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Extraire les attachments du DTO
    const { attachments, ...purchaseUpdateData } = updateDto;

    const updateData: any = {
      ...purchaseUpdateData,
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

    // Si des attachments sont fournis, on les ajoute
    if (attachments && attachments.length > 0) {
      await this.prisma.attachment.createMany({
        data: attachments.map((att) => ({
          purchaseId,
          type: AttachmentType.DA_ATTACHMENT, // Pièces jointes de la DA
          fileName: att.fileName,
          fileUrl: att.fileUrl,
          fileId: att.fileId,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          description: att.description,
          uploadedBy: user?.name,
        })),
      });
    }

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

  async getMyPurchases(userId: number, filters: FilterPurchaseDto = {}) {
    const pagination = parsePaginationParams(filters, {
      defaultPage: 1,
      defaultLimit: 10,
      maxLimit: 100,
    });

    const where: any = { creatorId: userId };

    if (filters.status) where.status = filters.status;
    if (filters.currentStep) where.currentStep = filters.currentStep;

    const [purchases, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
          items: true,
          attachments: true,
          validationWorkflows: {
            include: {
              validators: { orderBy: { order: 'asc' } },
            },
          },
        },
        orderBy: [{ currentStep: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.purchase.count({ where }),
    ]);

    const enriched = purchases.map((p) => ({
      ...p,
      amount: p.items.reduce((sum, item) => sum + item.amount, 0),
    }));

    const grouped: Record<string, any[]> = {};
    for (const step of STEP_ORDER) {
      const group = enriched.filter((p) => p.currentStep === step);
      if (group.length > 0) grouped[step] = group;
    }

    return {
      grouped,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
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

    const where = { ...baseWhere };

    if (filters.currentStep) {
      where.currentStep = filters.currentStep;
    }

    const [purchases, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
          items: true,
          attachments: true,
          validationWorkflows: {
            include: {
              validators: { orderBy: { order: 'asc' } },
            },
          },
          creator: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: [{ currentStep: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return {
      data: purchases,
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
