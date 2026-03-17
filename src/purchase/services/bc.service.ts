import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkflowConfigService } from '../../purchaseValidation/services/workflow-config.service';
import { UploadBCDto } from '../dto/bc.dto';
import {
  AttachmentType,
  PurchaseStatus,
  PurchaseStep,
  Role,
} from '@prisma/client';

@Injectable()
export class BCService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowConfig: WorkflowConfigService,
  ) {}

  async uploadBC(purchaseId: string, userId: number, dto: UploadBCDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new ForbiddenException('Seul un ACHETEUR peut uploader un BC');
    }

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: true },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.currentStep !== PurchaseStep.BC) {
      throw new BadRequestException("La DA n'est pas a l'etape BC");
    }

    if (
      purchase.status !== PurchaseStatus.PUBLISHED &&
      purchase.status !== PurchaseStatus.AWAITING_DOCUMENTS
    ) {
      throw new BadRequestException(
        'La DA doit etre en statut PUBLISHED ou AWAITING_DOCUMENTS pour uploader un BC',
      );
    }

    await this.prisma.attachment.deleteMany({
      where: { purchaseId, type: AttachmentType.PURCHASE_ORDER },
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        purchaseId,
        type: AttachmentType.PURCHASE_ORDER,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        uploadedBy: user.name,
      },
    });

    await this.prisma.validationWorkflow.deleteMany({
      where: { purchaseId, step: PurchaseStep.BC },
    });

    // Calculer le montant total de la DA
    const amount = purchase.items.reduce((sum, item) => sum + item.amount, 0);

    // Récupérer les rôles requis pour la validation BC selon le workflow config
    const requiredRoles = this.workflowConfig.getRequireValidators(
      PurchaseStep.BC,
      purchase.operationType,
      amount,
    );

    // Créer le workflow BC
    await this.prisma.validationWorkflow.create({
      data: {
        purchaseId,
        step: PurchaseStep.BC,
        currentStep: 0,
        isComplete: false,
        validators: {
          create: requiredRoles.map((role, index) => ({
            role,
            order: index,
            isValidated: false,
            userId: null,
            name: null,
            email: null,
            decision: null,
            validatedAt: null,
          })),
        },
      },
    });

    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: PurchaseStatus.PENDING_APPROVAL },
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      message: 'Bon de commande uploade avec succes',
    };
  }

  async getBC(purchaseId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        attachments: {
          where: { type: AttachmentType.PURCHASE_ORDER },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        validationWorkflows: {
          where: { step: PurchaseStep.BC },
          include: {
            validators: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    const bc = purchase.attachments[0] ?? null;
    const workflow = purchase.validationWorkflows[0] ?? null;

    return {
      purchaseId,
      bc,
      workflow: workflow
        ? {
            id: workflow.id,
            currentStep: workflow.currentStep,
            isComplete: workflow.isComplete,
            validators: workflow.validators,
          }
        : null,
    };
  }
}
