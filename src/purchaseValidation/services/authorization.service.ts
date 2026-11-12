import { Injectable, HttpStatus } from '@nestjs/common';
import { ValidatorRole, User } from '@prisma/client';
import { UserRepository } from '../../repository/user/user.repository';
import { WorkflowConfigService } from './workflow-config.service';
import { ValidationWorkflowService } from './validation-workflow.service';
import { AppException, ErrorCode } from 'src/common/errors';

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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `User ${userId} not found`,
      );
    }
    return user;
  }

  async getUserValidatorRole(userId: number): Promise<ValidatorRole> {
    const user = await this.validateUser(userId);
    return this.workflowConfig.roleToValidatorRole(user.role);
  }

  async checkUserCanValidate(purchaseId: string, userId: number) {
    const userRole = await this.getUserValidatorRole(userId);

    const { canValidate, validator } =
      await this.workflowService.canUserValidate(purchaseId, userRole);

    if (!canValidate) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.VALIDATION_NOT_YOUR_TURN,
        'Not your turn in the validation workflow',
      );
    }

    if (!validator) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.VALIDATION_VALIDATOR_NOT_FOUND,
        'Validator not found in the purchase workflow',
      );
    }

    return { userRole, validator };
  }

  async getUserAndCheckAuthorization(purchaseId: string, userId: number) {
    const user = await this.validateUser(userId);
    const userRole = this.workflowConfig.roleToValidatorRole(user.role);

    const { canValidate, validator } =
      await this.workflowService.canUserValidate(purchaseId, userRole);

    if (!canValidate) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.VALIDATION_NOT_YOUR_TURN,
        'Not your turn in the validation workflow',
      );
    }

    if (!validator) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.VALIDATION_VALIDATOR_NOT_FOUND,
        'Validator not found in the purchase workflow',
      );
    }

    return { user, userRole, validator };
  }

  async getUserWithRole(userId: number) {
    const user = await this.validateUser(userId);
    const userRole = this.workflowConfig.roleToValidatorRole(user.role);
    return { user, userRole };
  }
}
