import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowConfigService } from '../../purchaseValidation/services/workflow-config.service';
import { PurchaseStep, PurchaseStatus, AttachmentType } from '@prisma/client';

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
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    const totalAmount = purchase.items.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    // Logique selon le currentStep
    switch (purchase.currentStep) {
      case PurchaseStep.QR:
        throw new BadRequestException(
          'Utilisez POST /purchases/:id/quotations/submit pour soumettre les devis QR',
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
        throw new BadRequestException(
          `Impossible de soumettre a l'etape ${purchase.currentStep}`,
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
      throw new BadRequestException('Aucun PV cree');
    }

    if (pv.suppliers.length === 0) {
      throw new BadRequestException(
        'Ajoutez au moins un fournisseur avant de soumettre le PV',
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
      throw new BadRequestException('Aucun bon de commande uploade');
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
      throw new BadRequestException('Aucun bon de reception uploade');
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
      throw new BadRequestException('Aucune facture uploadee');
    }

    // Créer le workflow INVOICE
    const requiredRoles = this.workflowConfigService.getRequireValidators(
      PurchaseStep.INVOICE,
      purchase.operationType,
      totalAmount,
    );

    const workflow = await this.prisma.validationWorkflow.create({
      data: {
        purchaseId: purchase.id,
        step: PurchaseStep.INVOICE,
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
      currentStep: PurchaseStep.INVOICE,
      workflow: workflow.validators,
      message: 'Facture soumise pour validation',
    };
  }

  private async submitDAP(purchase: any, userId: number, totalAmount: number) {
    // Vérifier qu'il y a un DAP (on utilise OTHER car pas de type spécifique)
    const dap = purchase.attachments.find(
      (att) =>
        att.type === AttachmentType.OTHER && att.description?.includes('DAP'),
    );

    if (!dap) {
      throw new BadRequestException('Aucun DAP uploade');
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
      throw new BadRequestException('Aucune preuve de paiement uploadee');
    }

    // Créer le workflow PROOF_OF_PAYMENT
    const requiredRoles = this.workflowConfigService.getRequireValidators(
      PurchaseStep.PROOF_OF_PAYMENT,
      purchase.operationType,
      totalAmount,
    );

    const workflow = await this.prisma.validationWorkflow.create({
      data: {
        purchaseId: purchase.id,
        step: PurchaseStep.PROOF_OF_PAYMENT,
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
      currentStep: PurchaseStep.PROOF_OF_PAYMENT,
      workflow: workflow.validators,
      message: 'Preuve de paiement soumise pour validation',
    };
  }
}
