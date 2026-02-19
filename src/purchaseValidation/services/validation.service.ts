import { Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseStep } from '@prisma/client';
import { FilterPurchaseDto } from '../dto/filter-purchase.dto';
import { ValidatePurchaseDto } from '../dto/validate-purchase.dto';
import { RejectPurchaseDto } from '../dto/reject-purchase.dto';
import { RequestChangesDto } from '../dto/request-change.dto';
import { PurchaseQueryService } from './purchase-query.service';
import { ValidationActionService } from './validation-action.service';
import { AuthorizationService } from './authorization.service';
import { PurchaseRepository } from 'src/repository/purchase/purchase.repository';
import { ValidatorRepository } from 'src/repository/purchase';

@Injectable()
export class DAValidationService {
  constructor(
    private authService: AuthorizationService,
    private purchaseRepo: PurchaseRepository,
    private validatorRepo: ValidatorRepository,
    private queryService: PurchaseQueryService,
    private validationAction: ValidationActionService,
  ) {}

  async getPendingDAForValidator(userId: number, filters: FilterPurchaseDto) {
    const { userRole } = await this.authService.getUserWithRole(userId); // verification centralisée de l'utilisateur

    //on utlise les service de query pour recuperer les DA
    return this.queryService.findForValidator(userRole, {
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      status: filters.status,
      project: filters.project,
      region: filters.region,
      search: filters.search,
    });
  }

  async getDAById(id: string) {
    const purchase = await this.queryService.findById(id);

    if (!purchase) {
      throw new NotFoundException(
        `Demande d'achat avec l'ID ${id} non trouvée.`,
      );
    }

    return purchase;
  }

  async validateDA(
    purchaseId: string,
    userId: number,
    validateDto: ValidatePurchaseDto,
  ) {
    const { userRole } = await this.authService.getUserAndCheckAuthorization(
      purchaseId,
      userId,
    );

    const purchase = await this.purchaseRepo.findById(purchaseId);
    if (!purchase) {
      throw new NotFoundException(`Demande d'achat non trouvé.`);
    }

    const currentStep = purchase.currentStep;

    const result = await this.validationAction.validate({
      purchaseId,
      userId,
      userRole,
      comment: validateDto.comment,
    });

    if (result.wasCompleted) {
      const nextStepMap = {
        [PurchaseStep.DA]: PurchaseStep.QR,
        [PurchaseStep.QR]: PurchaseStep.PV,
        [PurchaseStep.PV]: PurchaseStep.BC,
        [PurchaseStep.BC]: PurchaseStep.BR,
      };

      const nextStep = nextStepMap[currentStep];
      if (nextStep) {
        await this.purchaseRepo.updateStep({
          id: purchaseId,
          currentStep: nextStep,
        });
      }
    }

    const stepMessages = {
      [PurchaseStep.DA]: `DA validée avec succès, Passage à l'étape de QR.`,
      [PurchaseStep.QR]: `QR validée avec succès, Passage à l'étape de PV.`,
      [PurchaseStep.PV]: `PV validée avec succès, Passage à l'étape de BC.`,
      [PurchaseStep.BC]: `BC validée avec succès, Passage à l'étape de BR.`,
    };

    return {
      ...result.purchase,
      message: result.wasCompleted
        ? stepMessages[currentStep] || `Validation complète.`
        : `Validation enregistrée. En attente des autres validateurs.`,
    };
  }

  async rejectDA(
    purchaseId: string,
    userId: number,
    rejectDto: RejectPurchaseDto,
  ) {
    const { userRole } = await this.authService.getUserAndCheckAuthorization(
      purchaseId,
      userId,
    );

    return this.validationAction.reject({
      purchaseId,
      userId,
      userRole,
      reason: rejectDto.comment,
    });
  }

  async requestChangesOnDA(
    purchaseId: string,
    userId: number,
    requestChangesDto: RequestChangesDto,
  ) {
    const { userRole } = await this.authService.getUserAndCheckAuthorization(
      purchaseId,
      userId,
    );

    return this.validationAction.requestChanges({
      purchaseId,
      userId,
      userRole,
      reason: requestChangesDto.reason,
    });
  }

  async getMyValidationHistory(userId: number, filters: FilterPurchaseDto) {
    await this.authService.validateUser(userId);

    const { page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const [validations, total] = await Promise.all([
      this.validatorRepo.findValidationHistory({
        userId,
        skip,
        take: limit,
      }),
      this.validatorRepo.count({
        userId,
        isValidated: true,
      }),
    ]);

    return {
      data: validations.map((v) => ({
        id: v.id,
        decision: v.decision,
        comment: v.comment,
        validatedAt: v.validatedAt,
        role: v.role,
        purchase: v.workflow.purchase,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Statistiques de validation pour l'utilisateur connecté
  async getMyValidationStats(userId: number) {
    const { userRole } = await this.authService.getUserWithRole(userId);

    const [pending, validated, rejected, changesRequested] = await Promise.all([
      this.queryService.findForValidator(userRole, {
        page: 1,
        limit: 1000,
      }),

      this.validatorRepo.countByDecision({
        userId,
        decision: 'VALIDATED',
      }),

      this.validatorRepo.countByDecision({
        userId,
        decision: 'REJECTED',
      }),

      this.validatorRepo.countByDecision({
        userId,
        decision: 'CHANGES_REQUESTED',
      }),
    ]);

    return {
      pending: pending.data.length,
      validated,
      rejected,
      changesRequested,
      total: validated + rejected + changesRequested,
    };
  }
}
