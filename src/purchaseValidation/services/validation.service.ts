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
    // 1. Récupération des données et de l'email (imbriqué dans l'objet user)
    const [auth, purchase] = await Promise.all([
      this.authService.getUserAndCheckAuthorization(purchaseId, userId),
      this.purchaseRepo.findById(purchaseId),
    ]);

    if (!purchase) {
      throw new NotFoundException(`Demande d'achat non trouvée.`);
    }

    const userEmail = auth.user.email;
    const currentStep = purchase.currentStep;

    // 2. Exécution de la validation métier
    const result = await this.validationAction.validate({
      purchaseId,
      userId,
      userRole: auth.userRole,
      comment: validateDto.comment,
    });

    // --- LOGIQUE DE NOTIFICATION (CONSIGNES LEAD) ---

    // A. Stopper immédiatement la relance pour celui qui vient de valider
    await this.notificationService.stopActiveReminders(purchaseId, userEmail);

    // B. Gérer la suite du flux (Validateur suivant ou Étape suivante)
    if (!result.wasCompleted) {
      // Le workflow de l'étape actuelle n'est pas fini (ex: il reste un autre validateur)
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
          true, // Active les relances pour le suivant
        );
      }
    } else {
      // L'étape est complète, on passe à la suivante
      const nextStepMap = {
        [PurchaseStep.DA]: PurchaseStep.QR,
        [PurchaseStep.QR]: PurchaseStep.PV,
        [PurchaseStep.PV]: PurchaseStep.BC,
        [PurchaseStep.BC]: PurchaseStep.BR,
        [PurchaseStep.INVOICE]: PurchaseStep.DAP,
        [PurchaseStep.DAP]: PurchaseStep.PROOF_OF_PAYMENT,
        [PurchaseStep.PROOF_OF_PAYMENT]: PurchaseStep.DONE,
      };

      const nextStep = nextStepMap[currentStep];

      if (nextStep) {
        let newStatus: PurchaseStatus = PurchaseStatus.PUBLISHED;

        const stepsAwaitingDocs = [
          PurchaseStep.QR,
          PurchaseStep.BC,
          PurchaseStep.BR,
          PurchaseStep.INVOICE,
          PurchaseStep.DAP,
          PurchaseStep.PROOF_OF_PAYMENT,
        ];

        if (stepsAwaitingDocs.includes(nextStep as any)) {
          newStatus = PurchaseStatus.AWAITING_DOCUMENTS;
        }

        // Mise à jour du dossier
        await this.purchaseRepo.update({
          where: { id: purchaseId },
          data: { currentStep: nextStep, status: newStatus },
        });

        // Notifier le PREMIER validateur de la nouvelle étape (si elle nécessite une validation)
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
      } else {
        // Fin du processus global
        await this.purchaseRepo.update({
          where: { id: purchaseId },
          data: { status: PurchaseStatus.VALIDATED, validatedAt: new Date() },
        });
      }
    }

    // 3. Messages de retour
    const stepMessages = {
      [PurchaseStep.DA]: `DA validée avec succès, passage à l'étape de QR.`,
      [PurchaseStep.QR]: `QR validée avec succès, passage à l'étape de PV.`,
      [PurchaseStep.PV]: `PV validée avec succès, passage à l'étape de BC.`,
      [PurchaseStep.BC]: `BC validée avec succès, passage à l'étape de BR.`,
      [PurchaseStep.INVOICE]: `Facture validée avec succès, passage à l'étape de DAP.`,
      [PurchaseStep.DAP]: `DAP validée avec succès, passage à l'étape de PREUVE DE PAIEMENT.`,
      [PurchaseStep.PROOF_OF_PAYMENT]: `Preuve de paiement validée avec succès, processus terminé.`,
    };

    return {
      id: purchaseId,
      status: result.nextStatus,
      message: result.wasCompleted
        ? stepMessages[currentStep] || `Étape validée avec succès.`
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

  /**
   * Mappe l'étape actuelle du processus d'achat vers l'événement de notification correspondant.
   * Utilisé pour déterminer quel template de mail envoyer au validateur suivant.
   */
  private getEventByStep(step: PurchaseStep): string {
    const mapping: Record<string, string> = {
      [PurchaseStep.DA]: OSDRM_PROCESS_EVENT.DA_CREATED,
      [PurchaseStep.QR]: OSDRM_PROCESS_EVENT.QR_UPLOADED,
      [PurchaseStep.PV]: OSDRM_PROCESS_EVENT.PV_UPLOADED,
      [PurchaseStep.BC]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
      [PurchaseStep.BR]: OSDRM_PROCESS_EVENT.BC_UPLOADED, // Réutilise le template BC ou un dédié si existant
      [PurchaseStep.INVOICE]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
      [PurchaseStep.DAP]: OSDRM_PROCESS_EVENT.DPA_CREATED,
      [PurchaseStep.PROOF_OF_PAYMENT]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
      [PurchaseStep.DONE]: OSDRM_PROCESS_EVENT.BC_UPLOADED,
    };

    // Retourne l'événement mappé ou DA_CREATED par défaut pour éviter les erreurs d'envoi
    return mapping[step] || OSDRM_PROCESS_EVENT.DA_CREATED;
  }
}
