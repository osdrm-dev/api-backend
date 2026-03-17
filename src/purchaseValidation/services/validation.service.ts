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
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';

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
    const { userRole } = await this.authService.getUserWithRole(userId); // verification centralisée de l'utilisateur

    // supprimer le critère de statut fourni par le front pour éviter de masquer des
    // DA dans des étapes autres que DA (notamment QR). la recherche applique déjà
    // les statuts appropriés.
    const { status, ...rest } = filters;

    //on utlise les service de query pour recuperer les DA
    return this.queryService.findForValidator(userRole, {
      page: rest.page,
      limit: rest.limit,
      sortBy: rest.sortBy,
      sortOrder: rest.sortOrder,
      // pas de status
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
    // Récupération de l'email imbriqué dans l'objet user
    const [
      {
        userRole,
        user: { email: userEmail },
      },
      purchase,
    ] = await Promise.all([
      this.authService.getUserAndCheckAuthorization(purchaseId, userId),
      this.purchaseRepo.findById(purchaseId),
    ]);

    if (!purchase) {
      throw new NotFoundException(`Demande d'achat non trouvé.`);
    }

    const currentStep = purchase.currentStep;

    // Validation métier
    const result = await this.validationAction.validate({
      purchaseId,
      userId,
      userRole,
      comment: validateDto.comment,
    });

    // --- LOGIQUE DE NOTIFICATION ---

    // 1. Stopper la notification de relance pour celui qui vient de valider
    await this.prisma.notification.updateMany({
      where: {
        resourceId: purchaseId,
        status: 'SENT',
        recipients: {
          array_contains: userEmail, // Utilisation de array_contains pour le type Json
        },
      },
      data: {
        status: 'VALIDATED',
        expiredAt: new Date(),
      },
    });

    // 2. Créer la notification pour le validateur SUIVANT
    if (!result.wasCompleted) {
      const nextValidator = await this.prisma.validator.findFirst({
        where: {
          workflow: { purchaseId },
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
          true, // Active les relances
        );
      }
    } else {
      // Si l'étape est complète (ex: DA terminée), on prépare l'étape suivante
      const nextStepMap = {
        [PurchaseStep.DA]: PurchaseStep.QR,
        [PurchaseStep.QR]: PurchaseStep.PV,
        [PurchaseStep.PV]: PurchaseStep.BC,
        [PurchaseStep.BC]: PurchaseStep.BR,
        // BR n'a pas de validation, passage direct via submit
        [PurchaseStep.INVOICE]: PurchaseStep.DAP,
        [PurchaseStep.DAP]: PurchaseStep.PROOF_OF_PAYMENT,
        [PurchaseStep.PROOF_OF_PAYMENT]: PurchaseStep.DONE,
      };

      const nextStep = nextStepMap[currentStep];

      if (nextStep) {
        // Logique de mise à jour de l'étape...
        await this.purchaseRepo.update({
          where: { id: purchaseId },
          data: {
            currentStep: nextStep,
            status:
              nextStep === PurchaseStep.QR || nextStep === PurchaseStep.BC
                ? PurchaseStatus.AWAITING_DOCUMENTS
                : PurchaseStatus.PUBLISHED,
          },
        });

        // Notification pour le tout premier validateur de la NOUVELLE étape
        const firstNextStepValidator = await this.prisma.validator.findFirst({
          where: {
            workflow: { purchaseId, step: nextStep },
            isValidated: false,
          },
          orderBy: { order: 'asc' },
        });

        if (firstNextStepValidator?.email) {
          await this.notificationService.createNotification(
            this.getEventByStep(nextStep),
            [firstNextStepValidator.email],
            purchaseId,
            { reference: purchase.reference },
            true,
          );
        }
      }
    }

    return {
      id: purchaseId,
      status: result.nextStatus,
      message: result.wasCompleted
        ? `Étape validée avec succès.`
        : `Validation enregistrée. En attente du validateur suivant.`,
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

  private getEventByStep(step: PurchaseStep): string {
    const mapping: Record<PurchaseStep, string> = {
      [PurchaseStep.DA]: OSDRM_PROCESS_EVENT.DA_CREATED,
      [PurchaseStep.QR]: OSDRM_PROCESS_EVENT.QR_UPLOADED,
      [PurchaseStep.PV]: OSDRM_PROCESS_EVENT.PV_UPLOADED,
      [PurchaseStep.BC]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
      [PurchaseStep.BR]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
      [PurchaseStep.INVOICE]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
      [PurchaseStep.DAP]: OSDRM_PROCESS_EVENT.DPA_CREATED,
      [PurchaseStep.PROOF_OF_PAYMENT]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
      [PurchaseStep.DONE]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
    };

    return mapping[step] || OSDRM_PROCESS_EVENT.DA_CREATED;
  }
}
