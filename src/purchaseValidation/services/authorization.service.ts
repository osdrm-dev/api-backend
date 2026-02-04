import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ValidatorRole, User } from '@prisma/client';
import { UserRepository } from '../../repository/user/user.repository';
import { WorkflowConfigService } from './workflow-config.service';
import { ValidationWorkflowService } from './validation-workflow.service';

//Service utilitaire pour les vérifications d'autorisation

@Injectable()
export class AuthorizationService {
  constructor(
    private userRepo: UserRepository,
    private workflowConfig: WorkflowConfigService,
    private workflowService: ValidationWorkflowService,
  ) {}

  //Récupère et valide l'utilisateur

  async validateUser(userId: number): Promise<User> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundException(`Utilisateur #${userId} non trouvé.`);
    }

    return user;
  }

  /**
   * Récupère le rôle validateur de l'utilisateur
   */
  async getUserValidatorRole(userId: number): Promise<ValidatorRole> {
    const user = await this.validateUser(userId);
    return this.workflowConfig.roleToValidatorRole(user.role);
  }

  //Vérifie si l'utilisateur peut valider une demande

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

    return {
      userRole,
      validator,
    };
  }

  // Récupère l'utilisateur et vérifie son autorisation

  async getUserAndCheckAuthorization(purchaseId: string, userId: number) {
    // Valider que l'utilisateur existe
    const user = await this.validateUser(userId);

    // Récupérer le rôle validateur
    const userRole = this.workflowConfig.roleToValidatorRole(user.role);

    // Vérifier l'autorisation
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

    return {
      user,
      userRole,
      validator,
    };
  }

  //Vérifie juste que l'utilisateur existe et récupère son rôle

  async getUserWithRole(userId: number) {
    const user = await this.validateUser(userId);
    const userRole = this.workflowConfig.roleToValidatorRole(user.role);

    return {
      user,
      userRole,
    };
  }
}
