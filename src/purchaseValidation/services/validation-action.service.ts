import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PurchaseStatus, ValidatorRole } from '@prisma/client';
import { ValidationWorkflowService } from './validation-workflow.service';
import { WorkflowConfigService } from './workflow-config.service';
import { PurchaseRepository } from '../../repository/purchase/purchase.repository';
import { AuditLogRepository } from '../../repository/audit/audit-log.repository';

export interface ValidationContext {
  purchaseId: string;
  userId: number;
  userRole: ValidatorRole;
  comment?: string;
}

export interface ValidationResult {
  purchase: any;
  wasCompleted: boolean;
  nextStatus: PurchaseStatus;
}

@Injectable()
export class ValidationActionService {
  constructor(
    private purchaseRepo: PurchaseRepository,
    private auditLogRepo: AuditLogRepository,
    private workflowService: ValidationWorkflowService,
    private workflowConfig: WorkflowConfigService,
  ) {}

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const { purchaseId, userId, userRole, comment } = context;

    const purchase = await this.getPurchaseWithWorkflow(purchaseId);
    this.validatePurchaseState(purchase);

    const { canValidate, validator } =
      await this.workflowService.canUserValidate(
        purchaseId,
        userRole,
        purchase.currentStep,
      );

    if (!canValidate || !validator) {
      throw new ForbiddenException(
        `Vous n'êtes pas autorisé à valider cette demande. Ce n'est pas encore votre tour.`,
      );
    }

    const currentWorkflow = purchase.validationWorkflows?.find(
      (w) => w.step === purchase.currentStep,
    );

    if (!currentWorkflow) {
      throw new BadRequestException(
        `Cette demande n'a pas de workflow pour l'étape ${purchase.currentStep}`,
      );
    }

    const [,] = await Promise.all([
      this.workflowService.updateValidator({
        validatorId: validator.id,
        userId,
        decision: 'VALIDATED',
        comment,
      }),
      this.workflowService.advanceWorkflow(currentWorkflow.id),
    ]);
    const updatedValidators = currentWorkflow.validators.map((v) =>
      v.id === validator.id ? { ...v, isValidated: true } : v,
    );
    const isComplete =
      this.workflowConfig.isWorkflowComplete(updatedValidators);

    const newStatus = isComplete ? PurchaseStatus.PUBLISHED : purchase.status;

    await this.purchaseRepo.update({
      where: { id: purchaseId },
      data: { status: newStatus },
    });

    this.auditLogRepo
      .createValidationLog({
        userId,
        action: 'VALIDATE',
        purchaseId,
        details: {
          decision: 'VALIDATED',
          comment,
          validatorRole: userRole,
          step: purchase.currentStep,
          previousStatus: purchase.status,
          newStatus,
          isComplete,
        },
      })
      .catch((err) => console.error('Audit log failed:', err));

    return {
      purchase: { id: purchaseId, status: newStatus },
      wasCompleted: isComplete,
      nextStatus: newStatus,
    };
  }

  async reject(context: ValidationContext & { reason: string }): Promise<any> {
    const { purchaseId, userId, userRole, reason } = context;

    const purchase = await this.getPurchaseWithWorkflow(purchaseId);
    this.validatePurchaseState(purchase);

    const { canValidate, validator } =
      await this.workflowService.canUserValidate(
        purchaseId,
        userRole,
        purchase.currentStep,
      );

    if (!canValidate || !validator) {
      throw new ForbiddenException(
        `Vous n'êtes pas autorisé à rejeter cette demande.`,
      );
    }

    await this.workflowService.updateValidator({
      validatorId: validator.id,
      userId,
      decision: 'REJECTED',
      comment: reason,
    });

    const updatedPurchase = await this.purchaseRepo.update({
      where: { id: purchaseId },
      data: {
        status: PurchaseStatus.REJECTED,
        observations: reason,
        closedAt: new Date(),
      },
    });

    await this.auditLogRepo.createValidationLog({
      userId,
      action: 'REJECT',
      purchaseId,
      details: {
        decision: 'REJECTED',
        reason,
        validatorRole: userRole,
        step: purchase.currentStep,
        previousStatus: purchase.status,
        newStatus: PurchaseStatus.REJECTED,
      },
    });

    return updatedPurchase;
  }

  async requestChanges(
    context: ValidationContext & { reason: string },
  ): Promise<any> {
    const { purchaseId, userId, userRole, reason } = context;

    const purchase = await this.getPurchaseWithWorkflow(purchaseId);
    this.validatePurchaseState(purchase);

    const { canValidate, validator } =
      await this.workflowService.canUserValidate(
        purchaseId,
        userRole,
        purchase.currentStep,
      );

    if (!canValidate || !validator) {
      throw new ForbiddenException(
        `Vous n'êtes pas autorisé à demander des modifications.`,
      );
    }

    await this.workflowService.updateValidator({
      validatorId: validator.id,
      userId,
      decision: 'CHANGE_REQUESTED',
      comment: reason,
    });

    const updatedPurchase = await this.purchaseRepo.update({
      where: { id: purchaseId },
      data: {
        status: PurchaseStatus.CHANGE_REQUESTED,
        observations: reason,
        closedAt: new Date(),
      },
    });

    await this.auditLogRepo.createValidationLog({
      userId,
      action: 'REQUEST_CHANGES',
      purchaseId,
      details: {
        decision: 'CHANGE_REQUESTED',
        reason,
        validatorRole: userRole,
        step: purchase.currentStep,
        previousStatus: purchase.status,
        newStatus: PurchaseStatus.CHANGE_REQUESTED,
      },
    });

    return updatedPurchase;
  }

  private async getPurchaseWithWorkflow(purchaseId: string) {
    const purchase = await this.purchaseRepo.findById(purchaseId);
    if (!purchase) {
      throw new NotFoundException(
        `Demande d'achat #${purchaseId} non trouvée.`,
      );
    }
    return purchase;
  }

  private validatePurchaseState(purchase: any): void {
    const validStatuses = [
      PurchaseStatus.PUBLISHED,
      PurchaseStatus.PENDING_APPROVAL,
      PurchaseStatus.IN_DEROGATION,
    ];

    if (!validStatuses.includes(purchase.status)) {
      throw new BadRequestException(
        `La demande #${purchase.id} n'est pas en attente de validation (status: ${purchase.status})`,
      );
    }

    // Vérifier que le workflow de l'étape COURANTE existe
    const currentWorkflow = purchase.validationWorkflows?.find(
      (w: any) => w.step === purchase.currentStep,
    );

    if (!currentWorkflow) {
      throw new BadRequestException(
        `Cette demande n'a pas de workflow de validation pour l'étape ${purchase.currentStep}`,
      );
    }
  }
}
