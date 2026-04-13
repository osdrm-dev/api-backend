import { Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseStep, PurchaseStatus } from '@prisma/client';
import { FilterPurchaseDto } from '../dto/filter-purchase.dto';
import { ValidatePurchaseDto } from '../dto/validate-purchase.dto';
import { RejectPurchaseDto } from '../dto/reject-purchase.dto';
import { RequestChangesDto } from '../dto/request-change.dto';
import { PurchaseQueryService } from './purchase-query.service';
import { ValidationActionService } from './validation-action.service';
import { AuthorizationService } from './authorization.service';
import { PurchaseRepository } from 'src/repository/purchase/purchase.repository';
import { ValidatorRepository } from 'src/repository/purchase';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { PrismaService } from 'prisma/prisma.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';

const NEXT_STEP_MAP: Partial<Record<PurchaseStep, PurchaseStep>> = {
  [PurchaseStep.DA]: PurchaseStep.QR,
  [PurchaseStep.QR]: PurchaseStep.PV,
  [PurchaseStep.PV]: PurchaseStep.BC,
  [PurchaseStep.BC]: PurchaseStep.BR,
  [PurchaseStep.INVOICE]: PurchaseStep.DAP,
  [PurchaseStep.DAP]: PurchaseStep.PROOF_OF_PAYMENT,
  [PurchaseStep.PROOF_OF_PAYMENT]: PurchaseStep.DONE,
};

const STEPS_AWAITING_DOCS = new Set<PurchaseStep>([
  PurchaseStep.QR,
  PurchaseStep.BC,
  PurchaseStep.BR,
  PurchaseStep.INVOICE,
  PurchaseStep.DAP,
  PurchaseStep.PROOF_OF_PAYMENT,
]);

const STEP_MESSAGES: Partial<Record<PurchaseStep, string>> = {
  [PurchaseStep.DA]: `DA validée avec succès, passage à l'étape de QR.`,
  [PurchaseStep.QR]: `QR validée avec succès, passage à l'étape de PV.`,
  [PurchaseStep.PV]: `PV validée avec succès, passage à l'étape de BC.`,
  [PurchaseStep.BC]: `BC validée avec succès, passage à l'étape de BR.`,
  [PurchaseStep.INVOICE]: `Facture validée avec succès, passage à l'étape de DAP.`,
  [PurchaseStep.DAP]: `DAP validée avec succès, passage à l'étape de PREUVE DE PAIEMENT.`,
  [PurchaseStep.PROOF_OF_PAYMENT]: `Preuve de paiement validée avec succès, processus terminé.`,
};

@Injectable()
export class DAValidationService {
  constructor(
    private authService: AuthorizationService,
    private purchaseRepo: PurchaseRepository,
    private validatorRepo: ValidatorRepository,
    private queryService: PurchaseQueryService,
    private validationAction: ValidationActionService,
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async getPendingDAForValidator(userId: number, filters: FilterPurchaseDto) {
    const { userRole } = await this.authService.getUserWithRole(userId);
    const { status, ...rest } = filters;
    return this.queryService.findForValidator(userRole, {
      page: rest.page,
      limit: rest.limit,
      sortBy: rest.sortBy,
      sortOrder: rest.sortOrder,
      project: rest.project,
      region: rest.region,
      search: rest.search,
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
    const [auth, purchase] = await Promise.all([
      this.authService.getUserAndCheckAuthorization(purchaseId, userId),
      this.purchaseRepo.findById(purchaseId),
    ]);

    if (!purchase) {
      throw new NotFoundException(`Demande d'achat non trouvée.`);
    }

    const userEmail = auth.user.email;
    const currentStep = purchase.currentStep;

    const result = await this.validationAction.validate({
      purchaseId,
      userId,
      userRole: auth.userRole,
      comment: validateDto.comment,
      preloadedPurchase: purchase,
      preloadedValidator: auth.validator,
    });

    await this.notificationService.stopActiveReminders(purchaseId, userEmail);

    if (!result.wasCompleted) {
      const nextValidator = await this.prisma.validator.findFirst({
        where: {
          workflow: { purchaseId, step: currentStep },
          isValidated: false,
        },
        orderBy: { order: 'asc' },
      });

      if (nextValidator?.email) {
        await this.notificationService.createNotification(
          this.getEventByStep(currentStep),
          [nextValidator.email],
          purchaseId,
          { reference: purchase.reference },
          true,
        );
      }
    } else {
      await this.handleStepCompletion(
        purchaseId,
        currentStep,
        purchase.reference,
      );
    }

    return {
      id: purchaseId,
      status: result.nextStatus,
      message: result.wasCompleted
        ? (STEP_MESSAGES[currentStep] ?? `Étape validée avec succès.`)
        : `Validation enregistrée. En attente du validateur suivant.`,
    };
  }

  private async handleStepCompletion(
    purchaseId: string,
    currentStep: PurchaseStep,
    reference: string,
  ) {
    const nextStep = NEXT_STEP_MAP[currentStep];

    if (!nextStep) {
      await this.purchaseRepo.update({
        where: { id: purchaseId },
        data: { status: PurchaseStatus.VALIDATED, validatedAt: new Date() },
      });
      return;
    }

    const newStatus = STEPS_AWAITING_DOCS.has(nextStep)
      ? PurchaseStatus.AWAITING_DOCUMENTS
      : PurchaseStatus.PUBLISHED;

    const [, firstNextStepValidator] = await Promise.all([
      this.purchaseRepo.update({
        where: { id: purchaseId },
        data: { currentStep: nextStep, status: newStatus },
      }),
      this.prisma.validator.findFirst({
        where: {
          workflow: { purchaseId, step: nextStep },
          isValidated: false,
        },
        orderBy: { order: 'asc' },
      }),
    ]);

    if (firstNextStepValidator?.email) {
      await this.notificationService.createNotification(
        this.getEventByStep(nextStep),
        [firstNextStepValidator.email],
        purchaseId,
        { reference },
        true,
      );
    }
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
      this.validatorRepo.findValidationHistory({ userId, skip, take: limit }),
      this.validatorRepo.count({ userId, isValidated: true }),
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

  async getMyValidationStats(userId: number) {
    const { userRole } = await this.authService.getUserWithRole(userId);

    const [pendingCount, validated, rejected, changesRequested] =
      await Promise.all([
        this.queryService.countForValidator(userRole),
        this.validatorRepo.countByDecision({ userId, decision: 'VALIDATED' }),
        this.validatorRepo.countByDecision({ userId, decision: 'REJECTED' }),
        this.validatorRepo.countByDecision({
          userId,
          decision: 'CHANGES_REQUESTED',
        }),
      ]);

    return {
      pending: pendingCount,
      validated,
      rejected,
      changesRequested,
      total: validated + rejected + changesRequested,
    };
  }

  private getEventByStep(step: PurchaseStep): string {
    const mapping: Partial<Record<PurchaseStep, string>> = {
      [PurchaseStep.DA]: OSDRM_PROCESS_EVENT.DA_CREATED,
      [PurchaseStep.QR]: OSDRM_PROCESS_EVENT.QR_UPLOADED,
      [PurchaseStep.PV]: OSDRM_PROCESS_EVENT.PV_UPLOADED,
      [PurchaseStep.BC]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
      [PurchaseStep.BR]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
      [PurchaseStep.INVOICE]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
      [PurchaseStep.DAP]: OSDRM_PROCESS_EVENT.DAP_CREATED,
      [PurchaseStep.PROOF_OF_PAYMENT]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
      [PurchaseStep.DONE]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
    };
    return mapping[step] ?? OSDRM_PROCESS_EVENT.DA_CREATED;
  }
}
