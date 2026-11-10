import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowConfigService } from '../../purchaseValidation/services/workflow-config.service';
import { PurchaseStep, PurchaseStatus, AttachmentType } from '@prisma/client';
import { AppException, ErrorCode } from 'src/common/errors';

@Injectable()
export class SubmitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowConfigService: WorkflowConfigService,
  ) {}

  async submitForValidation(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: true,
        attachments: true,
      },
    });

    if (!purchase) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
    }

    const totalAmount = purchase.items.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    // Logique selon le currentStep
    switch (purchase.currentStep) {
      case PurchaseStep.QR:
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.PURCHASE_SUBMIT_USE_QUOTATIONS,
          'Use the quotations submit endpoint for step QR',
        );
      case PurchaseStep.PV:
        return this.submitPV(purchase, userId, totalAmount);
      case PurchaseStep.BC:
        return this.submitBC(purchase, userId, totalAmount);
      case PurchaseStep.BR:
        return this.submitBR(purchase, userId, totalAmount);
      case PurchaseStep.INVOICE:
        return this.submitInvoice(purchase, userId, totalAmount);
      case PurchaseStep.DAP:
        return this.submitDAP(purchase, userId, totalAmount);
      case PurchaseStep.PROOF_OF_PAYMENT:
        return this.submitProofOfPayment(purchase, userId, totalAmount);
      default:
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.PURCHASE_SUBMIT_NOT_ALLOWED,
          `Cannot submit at step ${purchase.currentStep}`,
        );
    }
  }

  private async submitPV(purchase: any, userId: number, totalAmount: number) {
    // Vérifier qu'il y a un PV
    const pv = await this.prisma.pV.findUnique({
      where: { purchaseId: purchase.id },
      include: { suppliers: true },
    });

    if (!pv) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_PV_REQUIRED,
        'No PV created',
      );
    }

    if (pv.suppliers.length === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_PV_NO_SUPPLIER,
        'Add at least one supplier before submitting the PV',
      );
    }

    // Créer le workflow PV
    const requiredRoles = this.workflowConfigService.getRequireValidators(
      PurchaseStep.PV,
      purchase.operationType,
      totalAmount,
    );

    const workflow = await this.prisma.validationWorkflow.create({
      data: {
        purchaseId: purchase.id,
        step: PurchaseStep.PV,
        currentStep: 0,
        validators: {
          create: requiredRoles.map((role, index) => ({
            role,
            order: index,
            isValidated: false,
          })),
        },
      },
      include: { validators: { orderBy: { order: 'asc' } } },
    });

    await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: PurchaseStatus.PENDING_APPROVAL },
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: PurchaseStatus.PENDING_APPROVAL,
      currentStep: PurchaseStep.PV,
      workflow: workflow.validators,
      message: 'PV soumis pour validation',
    };
  }

  private async submitBC(purchase: any, userId: number, totalAmount: number) {
    // Vérifier qu'il y a un BC
    const bc = purchase.attachments.find(
      (att) => att.type === AttachmentType.PURCHASE_ORDER,
    );

    if (!bc) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_DOCUMENT_MISSING_BC,
        'No purchase order uploaded',
      );
    }

    // Créer le workflow BC
    const requiredRoles = this.workflowConfigService.getRequireValidators(
      PurchaseStep.BC,
      purchase.operationType,
      totalAmount,
    );

    const workflow = await this.prisma.validationWorkflow.create({
      data: {
        purchaseId: purchase.id,
        step: PurchaseStep.BC,
        currentStep: 0,
        validators: {
          create: requiredRoles.map((role, index) => ({
            role,
            order: index,
            isValidated: false,
          })),
        },
      },
      include: { validators: { orderBy: { order: 'asc' } } },
    });

    await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: PurchaseStatus.PENDING_APPROVAL },
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: PurchaseStatus.PENDING_APPROVAL,
      currentStep: PurchaseStep.BC,
      workflow: workflow.validators,
      message: 'Bon de commande soumis pour validation',
    };
  }

  private async submitBR(purchase: any, userId: number, totalAmount: number) {
    // Vérifier qu'il y a un BR
    const br = purchase.attachments.find(
      (att) => att.type === AttachmentType.DELIVERY_NOTE,
    );

    if (!br) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_DOCUMENT_MISSING_BR,
        'No goods receipt uploaded',
      );
    }

    // BR n'a pas de circuit de validation, passage direct à INVOICE
    await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        currentStep: PurchaseStep.INVOICE,
        status: PurchaseStatus.AWAITING_DOCUMENTS,
      },
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: PurchaseStatus.AWAITING_DOCUMENTS,
      currentStep: PurchaseStep.INVOICE,
      message: "Bon de reception enregistre, passage a l'etape FACTURE",
    };
  }

  private async submitInvoice(
    purchase: any,
    userId: number,
    totalAmount: number,
  ) {
    // Vérifier qu'il y a une facture
    const invoice = purchase.attachments.find(
      (att) => att.type === AttachmentType.INVOICE,
    );

    if (!invoice) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_DOCUMENT_MISSING_INVOICE,
        'No invoice uploaded',
      );
    }

    await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        currentStep: PurchaseStep.DAP,
        status: PurchaseStatus.AWAITING_DOCUMENTS,
      },
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: PurchaseStatus.AWAITING_DOCUMENTS,
      currentStep: PurchaseStep.DAP,
      message: "Facture enregistree, passage a l'etape DAP",
    };
  }

  private async submitDAP(purchase: any, userId: number, totalAmount: number) {
    // Vérifier qu'il y a un DAP (on utilise OTHER car pas de type spécifique)
    const dap = purchase.attachments.find(
      (att) =>
        att.type === AttachmentType.OTHER && att.description?.includes('DAP'),
    );

    if (!dap) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_DOCUMENT_MISSING_DAP,
        'No DAP uploaded',
      );
    }

    // Créer le workflow DAP
    const requiredRoles = this.workflowConfigService.getRequireValidators(
      PurchaseStep.DAP,
      purchase.operationType,
      totalAmount,
    );

    const workflow = await this.prisma.validationWorkflow.create({
      data: {
        purchaseId: purchase.id,
        step: PurchaseStep.DAP,
        currentStep: 0,
        validators: {
          create: requiredRoles.map((role, index) => ({
            role,
            order: index,
            isValidated: false,
          })),
        },
      },
      include: { validators: { orderBy: { order: 'asc' } } },
    });

    await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: PurchaseStatus.PENDING_APPROVAL },
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: PurchaseStatus.PENDING_APPROVAL,
      currentStep: PurchaseStep.DAP,
      workflow: workflow.validators,
      message: 'DAP soumis pour validation',
    };
  }

  private async submitProofOfPayment(
    purchase: any,
    userId: number,
    totalAmount: number,
  ) {
    // Vérifier qu'il y a une preuve de paiement
    const proof = purchase.attachments.find(
      (att) => att.type === AttachmentType.PROOF_OF_PAYMENT,
    );

    if (!proof) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_DOCUMENT_MISSING_PROOF_OF_PAYMENT,
        'No proof of payment uploaded',
      );
    }

    // PROOF_OF_PAYMENT n'a pas de circuit de validation, passage direct à DONE
    await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        currentStep: PurchaseStep.DONE,
        status: PurchaseStatus.VALIDATED,
        closedAt: new Date(),
      },
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: PurchaseStatus.VALIDATED,
      currentStep: PurchaseStep.DONE,
      message: 'Preuve de paiement enregistree, demande completee',
    };
  }
}
