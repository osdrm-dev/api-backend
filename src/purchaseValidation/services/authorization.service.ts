import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ValidatorRole, User } from '@prisma/client';
import { UserRepository } from '../../repository/user/user.repository';
import { WorkflowConfigService } from './workflow-config.service';
import { ValidationWorkflowService } from './validation-workflow.service';

@Injectable()
export class AuthorizationService {
  constructor(
    private userRepo: UserRepository,
    private workflowConfig: WorkflowConfigService,
    private workflowService: ValidationWorkflowService,
  ) {}

  async validateUser(userId: number): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException(`Utilisateur #${userId} non trouvé.`);
    }
    return user;
  }

  async getUserValidatorRole(userId: number): Promise<ValidatorRole> {
    const user = await this.validateUser(userId);
    return this.workflowConfig.roleToValidatorRole(user.role);
  }

  async checkUserCanValidate(purchaseId: string, userId: number) {
    const userRole = await this.getUserValidatorRole(userId);

    const { canValidate, validator, reason } =
      await this.workflowService.canUserValidate(purchaseId, userRole);

    if (!canValidate) {
      throw new ForbiddenException(
        reason ||
          "Vous n'êtes pas autorisé à effectuer cette action sur cette demande.",
      );
    }

    if (!validator) {
      throw new ForbiddenException(
        'Validateur non trouvé dans le workflow de cette demande.',
      );
    }

    return { userRole, validator };
  }

  async getUserAndCheckAuthorization(purchaseId: string, userId: number) {
    const user = await this.validateUser(userId);
    const userRole = this.workflowConfig.roleToValidatorRole(user.role);

    const { canValidate, validator, reason } =
      await this.workflowService.canUserValidate(purchaseId, userRole);

    if (!canValidate) {
      throw new ForbiddenException(
        reason || "Vous n'êtes pas autorisé à effectuer cette action.",
      );
    }

    if (!validator) {
      throw new ForbiddenException('Validateur non trouvé dans le workflow.');
    }

    return { user, userRole, validator };
  }

  async getUserWithRole(userId: number) {
    const user = await this.validateUser(userId);
    const userRole = this.workflowConfig.roleToValidatorRole(user.role);
    return { user, userRole };
  }
}
