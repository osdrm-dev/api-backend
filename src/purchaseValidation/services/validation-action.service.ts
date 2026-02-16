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

/**
 * Service pour gérer les actions de validation
 * Utilise les repositories pour l'accès aux données
 */
@Injectable()
export class ValidationActionService {
  constructor(
    private purchaseRepo: PurchaseRepository,
    private auditLogRepo: AuditLogRepository,
    private workflowService: ValidationWorkflowService,
    private workflowConfig: WorkflowConfigService,
  ) {}

  /**
   * Valide une demande (réutilisable pour toutes les étapes)
   */
  async validate(context: ValidationContext): Promise<ValidationResult> {
    const { purchaseId, userId, userRole, comment } = context;

    // Récupérer la demande
    const purchase = await this.getPurchaseWithWorkflow(purchaseId);

    // Vérifications communes
    this.validatePurchaseState(purchase);

    // Vérifier l'autorisation
    const { canValidate, validator } =
      await this.workflowService.canUserValidate(purchaseId, userRole);

    if (!canValidate || !validator) {
      throw new ForbiddenException(
        `Vous n'êtes pas autorisé à valider cette demande. Ce n'est pas encore votre tour.`,
      );
    }

    // Mettre à jour le validateur
    await this.workflowService.updateValidator({
      validatorId: validator.id,
      userId,
      decision: 'VALIDATED',
      comment,
    });

    // Avancer le workflow
    const currentWorkflow = purchase.validationWorkflows?.find(
      (w) => w.step === purchase.currentStep,
    );

    if (!currentWorkflow) {
      throw new BadRequestException(
        `Cette demande n'a pas de workflow pour l'étape actuelle`,
      );
    }

    await this.workflowService.advanceWorkflow(currentWorkflow.id);

    // Vérifier si le workflow est complet
    const updatedWorkflow = await this.workflowService.getWorkflow(purchaseId);
    const isComplete = this.workflowConfig.isWorkflowComplete(
      updatedWorkflow.validators,
    );

    // Déterminer le nouveau statut
    const newStatus = isComplete
      ? PurchaseStatus.VALIDATED
      : PurchaseStatus.PUBLISHED;

    // Mettre à jour la demande
    const updatedPurchase = await this.purchaseRepo.update({
      where: { id: purchaseId },
      data: {
        status: newStatus,
        validatedAt: isComplete ? new Date() : purchase.validatedAt,
      },
    });

    // Audit log
    await this.auditLogRepo.createValidationLog({
      userId,
      action: 'VALIDATE',
      purchaseId,
      details: {
        decision: 'VALIDATED',
        comment,
        validatorRole: userRole,
        previousStatus: purchase.status,
        newStatus,
        isComplete,
      },
    });

    return {
      purchase: updatedPurchase,
      wasCompleted: isComplete,
      nextStatus: newStatus,
    };
  }

  /**
   * Rejette une demande (réutilisable pour toutes les étapes)
   */
  async reject(context: ValidationContext & { reason: string }): Promise<any> {
    const { purchaseId, userId, userRole, reason } = context;

    const purchase = await this.getPurchaseWithWorkflow(purchaseId);
    this.validatePurchaseState(purchase);

    const { canValidate, validator } =
      await this.workflowService.canUserValidate(purchaseId, userRole);

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
        previousStatus: purchase.status,
        newStatus: PurchaseStatus.REJECTED,
      },
    });

    return updatedPurchase;
  }

  /**
   * Demande des modifications (réutilisable pour toutes les étapes)
   */
  async requestChanges(
    context: ValidationContext & { reason: string },
  ): Promise<any> {
    const { purchaseId, userId, userRole, reason } = context;

    const purchase = await this.getPurchaseWithWorkflow(purchaseId);
    this.validatePurchaseState(purchase);

    const { canValidate, validator } =
      await this.workflowService.canUserValidate(purchaseId, userRole);

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
        previousStatus: purchase.status,
        newStatus: PurchaseStatus.CHANGE_REQUESTED,
      },
    });

    return updatedPurchase;
  }

  /**
   * Récupère une demande avec son workflow
   */
  private async getPurchaseWithWorkflow(purchaseId: string) {
    const purchase = await this.purchaseRepo.findById(purchaseId);

    if (!purchase) {
      throw new NotFoundException(
        `Demande d'achat #${purchaseId} non trouvée.`,
      );
    }

    return purchase;
  }

  /**
   * Valide l'état de la demande
   */
  private validatePurchaseState(purchase: any): void {
    if (purchase.status !== PurchaseStatus.PUBLISHED) {
      throw new BadRequestException(
        `La demande #${purchase.id} n'est pas en attente de validation (status: ${purchase.status})`,
      );
    }

    const currentWorkflow = purchase.validationWorkflows?.find(
      (w) => w.step === purchase.currentStep,
    );

    if (!currentWorkflow) {
      throw new BadRequestException(
        `Cette demande n'a pas de workflow de validation pour l'étape actuelle`,
      );
    }
  }
}
