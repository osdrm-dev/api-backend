import { Injectable, NotFoundException } from '@nestjs/common';
import { OperationType, ValidatorRole, PurchaseStep } from '@prisma/client';
import { WorkflowConfigService } from './workflow-config.service';
import { ValidationWorkflowRepository } from '../../repository/purchase/validation-workflow.repository';
import { ValidatorRepository } from '../../repository/purchase/validator.repository';
import { UserRepository } from '../../repository/user/user.repository';

@Injectable()
export class ValidationWorkflowService {
  constructor(
    private workflowRepo: ValidationWorkflowRepository,
    private validatorRepo: ValidatorRepository,
    private userRepo: UserRepository,
    private workflowConfig: WorkflowConfigService,
  ) {}

  async createWorkflow(params: {
    purchaseId: string;
    step: PurchaseStep;
    operationType: OperationType;
    amount: number;
  }): Promise<void> {
    const { purchaseId, step, operationType, amount } = params;

    const requiredRoles = this.workflowConfig.getRequireValidators(
      step,
      operationType,
      amount,
    );

    const workflow = await this.workflowRepo.create({
      purchase: { connect: { id: purchaseId } },
      step,
      currentStep: 0,
      isComplete: false,
    });

    const validatorsData = requiredRoles.map((role, index) => ({
      workflowId: workflow.id,
      role,
      order: index,
      isValidated: false,
    }));

    await this.validatorRepo.createMany(validatorsData);
  }
  async getWorkflow(purchaseId: string, step?: PurchaseStep) {
    if (step) {
      const workflow = await this.workflowRepo.findByPurchaseIdAndStep(
        purchaseId,
        step,
      );
      if (!workflow) {
        throw new NotFoundException(
          `Workflow de validation non trouvé pour la DA #${purchaseId} à l'étape ${step}`,
        );
      }
      return workflow;
    }

    const workflow = await this.workflowRepo.findByPurchaseId(purchaseId);
    if (!workflow) {
      throw new NotFoundException(
        `Workflow de validation non trouvé pour la DA #${purchaseId}`,
      );
    }

    return workflow;
  }

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

  async advanceWorkflow(workflowId: string): Promise<void> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundException('Workflow non trouvé');

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

  async canUserValidate(
    purchaseId: string,
    userRole: ValidatorRole,
    currentStep?: PurchaseStep,
  ): Promise<{ canValidate: boolean; validator?: any; reason?: string }> {
    const workflow = await this.getWorkflow(purchaseId, currentStep);

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

    return { canValidate: !!validator, validator };
  }

  async resetWorkflow(purchaseId: string): Promise<void> {
    const workflow = await this.workflowRepo.findByPurchaseId(purchaseId);
    if (!workflow) throw new NotFoundException('Workflow non trouvé');

    await this.validatorRepo.resetByWorkflow(workflow.id);
    await this.workflowRepo.reset(workflow.id);
  }

  async recreateWorkflow(params: {
    purchaseId: string;
    step: PurchaseStep;
    operationType: OperationType;
    amount: number;
  }): Promise<void> {
    const { purchaseId, step } = params;

    const existingWorkflow = await this.workflowRepo.findByPurchaseIdAndStep(
      purchaseId,
      step,
    );
    if (existingWorkflow) {
      await this.workflowRepo.delete({ id: existingWorkflow.id });
    }

    await this.createWorkflow(params);
  }
}
