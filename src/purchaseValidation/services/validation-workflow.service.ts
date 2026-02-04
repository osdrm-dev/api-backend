import { Injectable, NotFoundException } from '@nestjs/common';
import { OperationType, ValidatorRole, PurchaseStep } from '@prisma/client';
import { WorkflowConfigService } from './workflow-config.service';
import { ValidationWorkflowRepository } from '../../repository/purchase/validation-workflow.repository';
import { ValidatorRepository } from '../../repository/purchase/validator.repository';
import { UserRepository } from '../../repository/user/user.repository';

/**
 * Service pour gérer les workflows de validation
 * Utilise les repositories pour l'accès aux données
 */
@Injectable()
export class ValidationWorkflowService {
  constructor(
    private workflowRepo: ValidationWorkflowRepository,
    private validatorRepo: ValidatorRepository,
    private userRepo: UserRepository,
    private workflowConfig: WorkflowConfigService,
  ) {}

  /**
   * Crée un workflow pour une étape spécifique
   */
  async createWorkflow(params: {
    purchaseId: string;
    step: PurchaseStep;
    operationType: OperationType;
    amount: number;
  }): Promise<void> {
    const { purchaseId, step, operationType, amount } = params;

    // Utilise la configuration pour déterminer les validateurs
    const requiredRoles = this.workflowConfig.getRequireValidators(
      step,
      operationType,
      amount,
    );

    // Crée le workflow
    const workflow = await this.workflowRepo.create({
      purchase: { connect: { id: purchaseId } },
      currentStep: 0,
      isComplete: false,
    });

    // Crée les validateurs dans l'ordre
    const validatorsData = requiredRoles.map((role, index) => ({
      workflowId: workflow.id,
      role,
      order: index,
      isValidated: false,
    }));

    await this.validatorRepo.createMany(validatorsData);
  }

  /**
   * Récupère un workflow avec tous ses validateurs
   */
  async getWorkflow(purchaseId: string) {
    const workflow = await this.workflowRepo.findByPurchaseId(purchaseId);

    if (!workflow) {
      throw new NotFoundException(
        `Workflow de validation non trouvé pour la DA #${purchaseId}`,
      );
    }

    return workflow;
  }

  /**
   * Met à jour un validateur (validation, rejet, demande de modifications)
   */
  async updateValidator(params: {
    validatorId: string;
    userId: number;
    decision: 'VALIDATED' | 'REJECTED' | 'CHANGE_REQUESTED';
    comment?: string;
  }) {
    const { validatorId, userId, decision, comment } = params;

    const userInfo = await this.userRepo.getUserInfo(userId);

    return this.validatorRepo.markAsValidated({
      id: validatorId,
      userId,
      decision,
      comment,
      userName: userInfo?.name,
      userEmail: userInfo?.email,
    });
  }

  /**
   * Avance le workflow à l'étape suivante
   */
  async advanceWorkflow(workflowId: string): Promise<void> {
    const workflow = await this.workflowRepo.findById(workflowId);

    if (!workflow) {
      throw new NotFoundException('Workflow non trouvé');
    }

    const isComplete = this.workflowConfig.isWorkflowComplete(
      workflow.validators,
    );

    const nextValidator = this.workflowConfig.getNextValidator(
      workflow.validators,
    );

    await this.workflowRepo.update({
      where: { id: workflowId },
      data: {
        currentStep: nextValidator ? nextValidator.order : workflow.currentStep,
        isComplete,
      },
    });
  }

  /**
   * Vérifie si un utilisateur peut effectuer une action sur le workflow
   */
  async canUserValidate(
    purchaseId: string,
    userRole: ValidatorRole,
  ): Promise<{
    canValidate: boolean;
    validator?: any;
    reason?: string;
  }> {
    const workflow = await this.getWorkflow(purchaseId);

    const isAuthorized = this.workflowConfig.isValidatorAuthorized(
      userRole,
      workflow.validators,
    );

    if (!isAuthorized) {
      return {
        canValidate: false,
        reason: "Ce n'est pas encore votre tour dans le workflow de validation",
      };
    }

    const nextValidator = this.workflowConfig.getNextValidator(
      workflow.validators,
    );

    const validator = workflow.validators.find(
      (v) => v.role === userRole && v.order === nextValidator?.order,
    );

    return {
      canValidate: true,
      validator,
    };
  }

  /**
   * Réinitialise complètement un workflow
   */
  async resetWorkflow(purchaseId: string): Promise<void> {
    const workflow = await this.workflowRepo.findByPurchaseId(purchaseId);

    if (!workflow) {
      throw new NotFoundException('Workflow non trouvé');
    }

    await this.validatorRepo.resetByWorkflow(workflow.id);

    await this.workflowRepo.reset(workflow.id);
  }

  /**
   * Supprime et recrée un workflow (si changement de montant ou type)
   */
  async recreateWorkflow(params: {
    purchaseId: string;
    step: PurchaseStep;
    operationType: OperationType;
    amount: number;
  }): Promise<void> {
    const { purchaseId } = params;

    // Supprimer l'ancien workflow s'il existe
    const existingWorkflow =
      await this.workflowRepo.findByPurchaseId(purchaseId);

    if (existingWorkflow) {
      await this.workflowRepo.delete({ id: existingWorkflow.id });
    }

    // Créer le nouveau workflow
    await this.createWorkflow(params);
  }
}
