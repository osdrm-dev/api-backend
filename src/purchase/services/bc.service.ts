import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkflowConfigService } from '../../purchaseValidation/services/workflow-config.service';
import { PVService } from './pv.service';
import { FileStorageService } from 'src/storage/services/file-storage.service';
import { buildBCPdf } from './bc-pdf.builder';
import {
  AttachmentType,
  PurchaseStatus,
  PurchaseStep,
  Role,
} from '@prisma/client';
import { assertIsOwningBuyer } from '../../utils/purchase-guards';
import { AppException, ErrorCode } from 'src/common/errors';

@Injectable()
export class BCService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowConfig: WorkflowConfigService,
    private readonly pvService: PVService,
    private readonly fileStorage: FileStorageService,
  ) {}

  /**
   * Génère un PDF de BC par fournisseur retenu dans le PV (articles isSelected),
   * remplace les BC existants et lance le circuit de validation BC.
   */
  async generateBC(purchaseId: string, userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_BUYER_ONLY,
        'Only a buyer can perform this action',
      );
    }

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: true },
    });

    if (!purchase) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
    }

    assertIsOwningBuyer(purchase, userId);

    if (purchase.currentStep !== PurchaseStep.BC) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_NOT_AT_STEP_BC,
        'Purchase is not at step BC',
      );
    }

    if (
      purchase.status !== PurchaseStatus.PUBLISHED &&
      purchase.status !== PurchaseStatus.AWAITING_DOCUMENTS
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_NOT_ACCEPTING_DOCUMENTS,
        'Purchase must be PUBLISHED or AWAITING_DOCUMENTS',
      );
    }

    const selection = await this.pvService.getSelectedItems(purchaseId);
    const suppliers = selection.suppliers.filter(
      (s) => s.selectedItems.length > 0,
    );
    if (!suppliers.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_DOCUMENT_MISSING_BC,
        'No selected item in the PV: cannot generate a purchase order',
      );
    }

    // Build + store every PDF before touching existing BCs, so a failure keeps the old ones.
    const now = new Date();
    const generated = await Promise.all(
      suppliers.map(async (s, i) => {
        const bcNumber =
          suppliers.length > 1
            ? `BC-${purchase.reference}-${i + 1}`
            : `BC-${purchase.reference}`;
        const buffer = await buildBCPdf({
          bcNumber,
          date: now,
          purchaseReference: purchase.reference,
          purchaseTitle: purchase.title,
          buyerName: user.name,
          supplier: {
            name: s.supplierName ?? 'Fournisseur',
            ...(s.supplierDetails ?? {}),
          },
          items: s.selectedItems,
        });
        const fileName = `${bcNumber}.pdf`;
        const file = await this.fileStorage.upload(
          {
            buffer,
            originalname: fileName,
            mimetype: 'application/pdf',
            size: buffer.length,
            encoding: '7bit',
          } as any,
          { userId, skipOptimization: true },
        );
        return { file, fileName, supplierName: s.supplierName };
      }),
    );

    const attachments = await this.prisma.$transaction(async (tx) => {
      await tx.attachment.deleteMany({
        where: { purchaseId, type: AttachmentType.PURCHASE_ORDER },
      });
      const created = await Promise.all(
        generated.map((g) =>
          tx.attachment.create({
            data: {
              purchaseId,
              fileId: g.file.id,
              type: AttachmentType.PURCHASE_ORDER,
              fileName: g.fileName,
              fileUrl: g.file.url,
              fileSize: g.file.size,
              mimeType: 'application/pdf',
              description: `Bon de commande généré par le système – ${g.supplierName ?? ''}`,
              uploadedBy: 'Système',
            },
          }),
        ),
      );

      await tx.validationWorkflow.deleteMany({
        where: { purchaseId, step: PurchaseStep.BC },
      });

      const amount = purchase.items.reduce((sum, item) => sum + item.amount, 0);
      const requiredRoles = this.workflowConfig.getRequireValidators(
        PurchaseStep.BC,
        purchase.operationType,
        amount,
      );

      await tx.validationWorkflow.create({
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
            })),
          },
        },
      });

      await tx.purchase.update({
        where: { id: purchaseId },
        data: { status: PurchaseStatus.PENDING_APPROVAL },
      });

      return created;
    });

    return {
      attachments: attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
      })),
      message: `${attachments.length} bon(s) de commande généré(s) et soumis pour validation`,
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
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
