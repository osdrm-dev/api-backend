import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ValidatorRole } from '@prisma/client';
import { UserRepository } from '../repositories';
import { WorkflowConfigService } from './workflow-config.service';
import { ValidationWorkflowService } from './validation-workflow.service';

// service reutilisable pour verifier les autorisations des utilisateurs et valider l'utilisateur
@Injectable()
export class AuthorizationService {
  constructor(
    private userRepo: UserRepository,
    private workflowConfig: WorkflowConfigService,
    private workflowService: ValidationWorkflowService,
  ) {}

  async validateUser(userId: number) {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundException(
        `Utilisateur avec l'ID ${userId} non trouvé.`,
      );
    }

    return user;
  }

  async getUserValidatorRole(userId: number): Promise<ValidatorRole> {
    const user = await this.validateUser(userId);
    return this.workflowConfig.roleToValidatorRole(user.fonction);
  }

  async checkUserCaNValidate(purchaseId: string, userId: number) {
    const user = await this.validateUser(userId);

    const userRole = this.workflowConfig.roleToValidatorRole(user.fonction);

    const { canValidate, validator, reason } =
      await this.workflowService.canUserValidate(purchaseId, userRole);

    if (!canValidate) {
      throw new ForbiddenException(
        reason ||
          `L'utilisateur avec l'ID ${userId} n'est pas autorisé à valider cette demande.`,
      );
    }

    if (!validator) {
      throw new NotFoundException(
        `Aucun validateur trouvé pour l'utilisateur avec l'ID ${userId} dans cette demande.`,
      );
    }

    return {
      user,
      userRole,
      validator,
    };
  }

  async getUserWithRole(userId: number) {
    const user = await this.validateUser(userId);
    const userRole = this.workflowConfig.roleToValidatorRole(user.role);

    return {
      user,
      userRole,
    };
  }
}
