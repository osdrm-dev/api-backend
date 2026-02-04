import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchaseRepository } from 'src/repository/purchase/purchase.repository';
import { UserRepository } from 'src/repository/user/user.repository';
import { ValidatorRepository } from 'src/repository/purchase/validator.repository';
import { ValidationWorkflowRepository } from 'src/repository/purchase/validation-workflow.repository';
import { AuditLogRepository } from 'src/repository/audit/audit-log.repository';
import { WorkflowConfigService } from './services/workflow-config.service';
import { ValidationWorkflowService } from './services/validation-workflow.service';
import { ValidationActionService } from './services/validation-action.service';
import { PurchaseQueryService } from './services/purchase-query.service';
import { AuthorizationService } from './services/authorization.service';
import { DAValidationService } from './services/da-validation.service';
import { DAValidationController } from './controllers/da-validation.controller';

@Module({
  controllers: [DAValidationController],
  providers: [
    PrismaService,
    PurchaseRepository,
    UserRepository,
    ValidationWorkflowRepository,
    ValidatorRepository,
    AuditLogRepository,
    WorkflowConfigService,
    ValidationWorkflowService,
    ValidationActionService,
    PurchaseQueryService,
    AuthorizationService,
    DAValidationService,
  ],
  exports: [
    PurchaseRepository,
    UserRepository,
    ValidationWorkflowRepository,
    ValidatorRepository,
    AuditLogRepository,
    WorkflowConfigService,
    ValidationWorkflowService,
    ValidationActionService,
    PurchaseQueryService,
    AuthorizationService,
    DAValidationService,
  ],
})
export class PurchaseModule {}
