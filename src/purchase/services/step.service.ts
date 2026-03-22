import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkflowConfigService } from 'src/purchaseValidation/services/workflow-config.service';
import {
  AttachmentType,
  PurchaseStatus,
  PurchaseStep,
  Role,
} from '@prisma/client';

export type DocStep = 'BR' | 'INVOICE' | 'DAP' | 'PROOF_OF_PAYMENT';

type CfgEntry = {
  step: PurchaseStep;
  type: AttachmentType;
  label: string;
  hasWorkflow: boolean;
};

const CFG: { [K in DocStep]: CfgEntry } = {
  BR: {
    step: PurchaseStep.BR,
    type: AttachmentType.DELIVERY_NOTE,
    label: 'Bon de réception',
    hasWorkflow: false,
  },
  INVOICE: {
    step: PurchaseStep.INVOICE,
    type: AttachmentType.INVOICE,
    label: 'Facture',
    hasWorkflow: false,
  },
  DAP: {
    step: PurchaseStep.DAP,
    type: AttachmentType.OTHER,
    label: 'DAP',
    hasWorkflow: true,
  },
  PROOF_OF_PAYMENT: {
    step: PurchaseStep.PROOF_OF_PAYMENT,
    type: AttachmentType.PROOF_OF_PAYMENT,
    label: 'Preuve de paiement',
    hasWorkflow: false,
  },
};

const NEXT_STEP: { [K in PurchaseStep]?: PurchaseStep } = {
  [PurchaseStep.BR]: PurchaseStep.INVOICE,
  [PurchaseStep.INVOICE]: PurchaseStep.DAP,
  [PurchaseStep.DAP]: PurchaseStep.PROOF_OF_PAYMENT,
  [PurchaseStep.PROOF_OF_PAYMENT]: PurchaseStep.DONE,
};

@Injectable()
export class DocumentStepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowConfig: WorkflowConfigService,
  ) {}

  private async assertAcheteur(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new ForbiddenException(
        'Seul un ACHETEUR peut effectuer cette action',
      );
    }
    return user;
  }

  async upload(
    docStep: DocStep,
    purchaseId: string,
    userId: number,
    dto: {
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
      justification?: string;
    },
  ) {
    const cfg = CFG[docStep];
    const user = await this.assertAcheteur(userId);

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");

    if (purchase.currentStep !== cfg.step) {
      throw new BadRequestException(`La DA n'est pas a l'etape ${docStep}`);
    }

    // Bloquer si un workflow est déjà en cours
    if (purchase.status === PurchaseStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Un workflow de validation est deja en cours. Impossible de re-uploader.',
      );
    }

    // Autoriser l'upload uniquement si AWAITING_DOCUMENTS ou PUBLISHED
    if (
      purchase.status !== PurchaseStatus.AWAITING_DOCUMENTS &&
      purchase.status !== PurchaseStatus.PUBLISHED
    ) {
      throw new BadRequestException(
        'La DA doit etre en statut AWAITING_DOCUMENTS ou PUBLISHED',
      );
    }

    await this.prisma.attachment.deleteMany({
      where: { purchaseId, type: cfg.type },
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        purchaseId,
        type: cfg.type,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        description: dto.justification
          ? `Justification incoherence BC: ${dto.justification}`
          : undefined,
        uploadedBy: user.name,
      },
    });

    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: PurchaseStatus.AWAITING_DOCUMENTS },
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      message: `${cfg.label} uploade avec succes`,
    };
  }

  async submit(docStep: DocStep, purchaseId: string, userId: number) {
    const cfg = CFG[docStep];
    await this.assertAcheteur(userId);

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: true },
    });
    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");

    if (purchase.currentStep !== cfg.step) {
      throw new BadRequestException(`La DA n'est pas a l'etape ${docStep}`);
    }

    // Bloquer si un workflow est déjà en cours pour cette étape
    if (purchase.status === PurchaseStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Un workflow de validation est deja en cours pour cette etape. Attendez la decision des validateurs.',
      );
    }

    if (purchase.status !== PurchaseStatus.AWAITING_DOCUMENTS) {
      throw new BadRequestException(
        "Uploadez d'abord le document avant de soumettre",
      );
    }

    const doc = await this.prisma.attachment.findFirst({
      where: { purchaseId, type: cfg.type },
    });
    if (!doc) {
      throw new BadRequestException(
        `Aucun document trouve pour l'etape ${docStep}. Uploadez d'abord.`,
      );
    }

    const nextStep = NEXT_STEP[cfg.step];

    // BR, INVOICE, PROOF_OF_PAYMENT → pas de workflow, passage direct à l'étape suivante
    if (!cfg.hasWorkflow) {
      const updateData: any = {
        currentStep: nextStep,
        status:
          nextStep === PurchaseStep.DONE
            ? PurchaseStatus.VALIDATED
            : PurchaseStatus.AWAITING_DOCUMENTS,
      };

      if (docStep === 'BR') updateData.receivedAt = new Date();
      if (docStep === 'PROOF_OF_PAYMENT') updateData.closedAt = new Date();

      await this.prisma.purchase.update({
        where: { id: purchaseId },
        data: updateData,
      });

      return {
        purchaseId,
        currentStep: nextStep,
        status: updateData.status,
        message: `${cfg.label} soumis. Passage a l'etape suivante.`,
      };
    }

    // DAP → créer workflow de validation
    const amount = purchase.items.reduce((sum, item) => sum + item.amount, 0);

    const requiredRoles = this.workflowConfig.getRequireValidators(
      cfg.step,
      purchase.operationType,
      amount,
    );

    // Supprimer tout workflow existant pour cette étape avant d'en créer un nouveau
    await this.prisma.validationWorkflow.deleteMany({
      where: { purchaseId, step: cfg.step },
    });

    const workflow = await this.prisma.validationWorkflow.create({
      data: {
        purchaseId,
        step: cfg.step,
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
      include: {
        validators: { orderBy: { order: 'asc' } },
      },
    });

    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: PurchaseStatus.PENDING_APPROVAL },
    });

    return {
      purchaseId,
      currentStep: cfg.step,
      status: PurchaseStatus.PENDING_APPROVAL,
      workflow: workflow.validators,
      message: `${cfg.label} soumis pour validation.`,
    };
  }

  async get(docStep: DocStep, purchaseId: string) {
    const cfg = CFG[docStep];

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        attachments: {
          where: {
            type:
              docStep === 'INVOICE'
                ? { in: [cfg.type, AttachmentType.PURCHASE_ORDER] }
                : cfg.type,
          },
          orderBy: { createdAt: 'desc' },
        },
        validationWorkflows: {
          where: { step: cfg.step },
          include: {
            validators: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");

    const workflow = purchase.validationWorkflows[0] ?? null;

    if (docStep === 'INVOICE') {
      const atts = purchase.attachments as any[];
      return {
        purchaseId,
        document: atts.find((a) => a.type === AttachmentType.INVOICE) ?? null,
        bcReference:
          atts.find((a) => a.type === AttachmentType.PURCHASE_ORDER) ?? null,
        workflow,
      };
    }

    return {
      purchaseId,
      document: purchase.attachments[0] ?? null,
      workflow,
    };
  }
}
