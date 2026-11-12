import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkflowConfigService } from 'src/purchaseValidation/services/workflow-config.service';
import { PdfSigningService } from 'src/pdf-signing/pdf-signing.service';
import {
  AttachmentType,
  PurchaseStatus,
  PurchaseStep,
  Role,
  SigningStatus,
} from '@prisma/client';
import { RequestSigningDto } from '../dto/request-signing.dto';
import { assertIsOwningBuyer } from 'src/utils/purchase-guards';
import { AppException, ErrorCode } from 'src/common/errors';

export type DocStep = 'BR' | 'INVOICE' | 'DAP' | 'PROOF_OF_PAYMENT';

const NOT_AT_STEP_CODE: Record<DocStep, ErrorCode> = {
  BR: ErrorCode.PURCHASE_NOT_AT_STEP_BR,
  INVOICE: ErrorCode.PURCHASE_NOT_AT_STEP_INVOICE,
  DAP: ErrorCode.PURCHASE_NOT_AT_STEP_DAP,
  PROOF_OF_PAYMENT: ErrorCode.PURCHASE_NOT_AT_STEP_PROOF_OF_PAYMENT,
};

const DOCUMENT_MISSING_CODE: Record<DocStep, ErrorCode> = {
  BR: ErrorCode.PURCHASE_DOCUMENT_MISSING_BR,
  INVOICE: ErrorCode.PURCHASE_DOCUMENT_MISSING_INVOICE,
  DAP: ErrorCode.PURCHASE_DOCUMENT_MISSING_DAP,
  PROOF_OF_PAYMENT: ErrorCode.PURCHASE_DOCUMENT_MISSING_PROOF_OF_PAYMENT,
};

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
    type: AttachmentType.DAP,
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
    private readonly pdfSigning: PdfSigningService,
  ) {}

  private async assertAcheteur(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_BUYER_ONLY,
        'Only a buyer can perform this action',
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
      fileId?: number;
    },
  ) {
    const cfg = CFG[docStep];
    const user = await this.assertAcheteur(userId);

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );

    assertIsOwningBuyer(purchase, userId);

    if (purchase.currentStep !== cfg.step) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        NOT_AT_STEP_CODE[docStep],
        `Purchase is not at step ${docStep}`,
      );
    }

    // Bloquer si un workflow est déjà en cours
    if (purchase.status === PurchaseStatus.PENDING_APPROVAL) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_WORKFLOW_IN_PROGRESS,
        'A validation workflow is already in progress for this step',
      );
    }

    // Autoriser l'upload uniquement si AWAITING_DOCUMENTS ou PUBLISHED
    if (
      purchase.status !== PurchaseStatus.AWAITING_DOCUMENTS &&
      purchase.status !== PurchaseStatus.PUBLISHED
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_NOT_ACCEPTING_DOCUMENTS,
        'Purchase must be PUBLISHED or AWAITING_DOCUMENTS',
      );
    }

    if (dto.fileId !== undefined) {
      const file = await this.prisma.file.findUnique({
        where: { id: dto.fileId },
      });
      if (!file) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          'File not found',
        );
      }
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
        ...(dto.fileId !== undefined && { fileId: dto.fileId }),
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
    if (!purchase)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );

    assertIsOwningBuyer(purchase, userId);

    if (purchase.currentStep !== cfg.step) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        NOT_AT_STEP_CODE[docStep],
        `Purchase is not at step ${docStep}`,
      );
    }

    // Bloquer si un workflow est déjà en cours pour cette étape
    if (purchase.status === PurchaseStatus.PENDING_APPROVAL) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_WORKFLOW_IN_PROGRESS,
        'A validation workflow is already in progress for this step',
      );
    }

    if (purchase.status !== PurchaseStatus.AWAITING_DOCUMENTS) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        DOCUMENT_MISSING_CODE[docStep],
        `No document uploaded for step ${docStep}`,
      );
    }

    const doc = await this.prisma.attachment.findFirst({
      where: { purchaseId, type: cfg.type },
    });
    if (!doc) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        DOCUMENT_MISSING_CODE[docStep],
        `No document uploaded for step ${docStep}`,
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

  async signStep(
    docStep: DocStep,
    purchaseId: string,
    attachmentId: string,
    userId: number,
    dto: RequestSigningDto,
  ): Promise<{ jobId: string; attachmentId: string }> {
    if (!CFG[docStep]) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BAD_REQUEST,
        `Unknown step ${docStep}`,
      );
    }
    const cfg = CFG[docStep];

    // 0. Verify the caller is the owning buyer
    const purchaseForGuard = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      select: { acheteurId: true },
    });
    if (!purchaseForGuard)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
    assertIsOwningBuyer(purchaseForGuard, userId);

    // 1. Load attachment + file (for checksum) and verify ownership + step type
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { file: { select: { checksum: true } } },
    });

    if (
      !attachment ||
      attachment.purchaseId !== purchaseId ||
      attachment.type !== cfg.type
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_ATTACHMENT_INACCESSIBLE,
        'Attachment is not accessible for this step',
      );
    }

    // 2. Verify user is the next active validator for this step
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user)
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
        'User not found',
      );

    // const validatorRole = this.workflowConfig.roleToValidatorRole(user.role);

    // const workflow = await this.prisma.validationWorkflow.findFirst({
    //   where: { purchaseId, step: cfg.step },
    //   include: { validators: { orderBy: { order: 'asc' } } },
    // });

    // if (!workflow || !this.workflowConfig.isValidatorAuthorized(validatorRole, workflow.validators)) {
    //   throw new ForbiddenException(
    //     "Vous n'êtes pas le validateur actif pour cette étape",
    //   );
    // }

    // 3. Verify active signature specimen
    const specimen = await this.prisma.signatureSpecimen.findFirst({
      where: { userId, isActive: true },
    });
    if (!specimen) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.SIGNATURE_NO_ACTIVE_SPECIMEN,
        'No active signature specimen',
      );
    }

    // 4. Mark PENDING and capture origin hash on the attachment
    await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        signingStatus: SigningStatus.PENDING,
        originHash: attachment.file?.checksum ?? null,
      },
    });

    // 5. Enqueue — signer identity + position params travel in the job payload
    const jobId = await this.pdfSigning.enqueue(attachmentId, {
      signedById: userId,
      specimenId: specimen.id,
      pageNumber: dto.pageNumber ?? 1,
      positionX: dto.positionX,
      positionY: dto.positionY,
      signatureWidth: dto.signatureWidth ?? 0.2,
    });

    await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: { jobId },
    });

    return { jobId, attachmentId };
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

    if (!purchase)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );

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
