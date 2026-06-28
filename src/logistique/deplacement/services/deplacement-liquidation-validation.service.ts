import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  LgDeplacementStatus,
  LgLiquidationValidationStatus,
  LgLiquidationValidatorRole,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { LiquidationValidationRepository } from 'src/repository/deplacement/liquidation-validation.repository';

export interface CurrentUser {
  id: number;
  role: string;
}

const DECIDABLE_STATUSES: LgLiquidationValidationStatus[] = [
  LgLiquidationValidationStatus.VALIDEE,
  LgLiquidationValidationStatus.REJETEE,
];

const BLOCKED_DEPLACEMENT_STATUSES: string[] = [
  LgDeplacementStatus.ANNULEE,
  LgDeplacementStatus.REFUSEE,
];

@Injectable()
export class LiquidationValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deplacementRepository: DeplacementRepository,
    private readonly validationRepository: LiquidationValidationRepository,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Crée les 3 lignes de validation dans une transaction existante.
   * Appelée par DeplacementLiquidationService.submit / resubmit.
   */
  async createValidationRows(
    tx: Prisma.TransactionClient,
    liquidationId: string,
  ) {
    return this.validationRepository.createValidationRows(tx, liquidationId);
  }

  /**
   * Réinitialise les 3 lignes à EN_ATTENTE (reset complet) dans une transaction.
   */
  async resubmitReset(tx: Prisma.TransactionClient, liquidationId: string) {
    return this.validationRepository.resetValidations(tx, liquidationId);
  }

  /**
   * Détail des 3 validations d'une liquidation (FR-17).
   */
  async getValidationDetail(deplacementId: string) {
    const dep = await this.deplacementRepository.findById(deplacementId);
    if (!dep)
      throw new NotFoundException(`Déplacement ${deplacementId} introuvable.`);
    if (!dep.liquidation)
      throw new NotFoundException(
        'Aucune liquidation soumise pour ce déplacement.',
      );
    return this.validationRepository.findValidationsByLiquidationId(
      dep.liquidation.id,
    );
  }

  /**
   * Déduit le rôle-validateur ciblé à partir du rôle global de l'utilisateur.
   * Pour l'ADMIN, le rôle doit être fourni explicitement (explicitRole).
   */
  resolveTargetRole(
    currentUser: CurrentUser,
    explicitRole?: LgLiquidationValidatorRole,
  ): LgLiquidationValidatorRole {
    if (currentUser.role === Role.ADMIN) {
      if (!explicitRole) {
        throw new UnprocessableEntityException(
          'Un administrateur doit préciser le rôle ciblé (DEMANDEUR, OM ou CFO).',
        );
      }
      return explicitRole;
    }

    switch (currentUser.role) {
      case Role.DEMANDEUR:
        return LgLiquidationValidatorRole.DEMANDEUR;
      case Role.OM:
        return LgLiquidationValidatorRole.OM;
      case Role.CFO:
        return LgLiquidationValidatorRole.CFO;
      default:
        throw new ForbiddenException(
          'Votre rôle ne vous autorise pas à valider une liquidation.',
        );
    }
  }

  /**
   * Vérifie que l'utilisateur courant peut décider sur la ligne `role`
   * du déplacement donné (FR-8/9/10 + cas requestorId null).
   */
  private assertCanDecide(
    role: LgLiquidationValidatorRole,
    currentUser: CurrentUser,
    deplacement: { requestorId: number | null },
  ) {
    const isAdmin = currentUser.role === Role.ADMIN;

    if (role === LgLiquidationValidatorRole.DEMANDEUR) {
      if (deplacement.requestorId == null) {
        throw new UnprocessableEntityException(
          "Le demandeur d'origine n'est plus actif, contactez un administrateur.",
        );
      }
      if (!isAdmin && currentUser.id !== deplacement.requestorId) {
        throw new ForbiddenException(
          "Seul l'auteur de la demande peut valider la ligne DEMANDEUR.",
        );
      }
      return;
    }

    if (role === LgLiquidationValidatorRole.OM) {
      if (!isAdmin && currentUser.role !== Role.OM) {
        throw new ForbiddenException(
          'Seul un utilisateur OM peut valider la ligne OM.',
        );
      }
      return;
    }

    if (role === LgLiquidationValidatorRole.CFO) {
      if (!isAdmin && currentUser.role !== Role.CFO) {
        throw new ForbiddenException(
          'Seul un utilisateur CFO peut valider la ligne CFO.',
        );
      }
      return;
    }
  }

  /**
   * Enregistre la décision (VALIDEE/REJETEE) d'un valideur sur une ligne,
   * met à jour le statut du déplacement le cas échéant, le tout dans une
   * transaction avec relecture de l'état (concurrence — Edge Cases).
   */
  async decide(
    deplacementId: string,
    role: LgLiquidationValidatorRole,
    decision: LgLiquidationValidationStatus,
    commentaire: string | undefined,
    currentUser: CurrentUser,
  ) {
    if (!DECIDABLE_STATUSES.includes(decision)) {
      throw new UnprocessableEntityException(
        'La décision doit être VALIDEE ou REJETEE.',
      );
    }

    const dep = await this.deplacementRepository.findById(deplacementId);
    if (!dep)
      throw new NotFoundException(`Déplacement ${deplacementId} introuvable.`);

    if (BLOCKED_DEPLACEMENT_STATUSES.includes(dep.status)) {
      throw new UnprocessableEntityException(
        `Aucune validation possible : le déplacement est en statut ${dep.status}.`,
      );
    }

    if (!dep.liquidation) {
      throw new NotFoundException(
        'Aucune liquidation soumise pour ce déplacement.',
      );
    }

    this.assertCanDecide(role, currentUser, dep);

    const liquidationId = dep.liquidation.id;

    const result = await this.prisma.$transaction(async (tx) => {
      // Relecture de l'état dans la transaction (concurrence)
      const rows = await this.validationRepository.findValidationsForUpdate(
        tx,
        liquidationId,
      );
      const target = rows.find((r) => r.role === role);
      if (!target) {
        throw new NotFoundException(
          `Ligne de validation ${role} introuvable pour cette liquidation.`,
        );
      }
      if (target.status !== LgLiquidationValidationStatus.EN_ATTENTE) {
        throw new ConflictException('Cette validation a déjà été traitée.');
      }

      await this.validationRepository.updateValidationDecision(tx, target.id, {
        status: decision,
        validatorId: currentUser.id,
        commentaire,
      });

      // Recalcul de l'état après mise à jour de la ligne ciblée
      const updatedRows = rows.map((r) =>
        r.id === target.id ? { ...r, status: decision } : r,
      );

      let newDeplacementStatus: LgDeplacementStatus | null = null;

      const hasRejection = updatedRows.some(
        (r) => r.status === LgLiquidationValidationStatus.REJETEE,
      );
      const allValidated = updatedRows.every(
        (r) => r.status === LgLiquidationValidationStatus.VALIDEE,
      );

      if (
        hasRejection &&
        dep.status !== LgDeplacementStatus.LIQUIDATION_REJETEE
      ) {
        newDeplacementStatus = LgDeplacementStatus.LIQUIDATION_REJETEE;
      } else if (allValidated) {
        newDeplacementStatus = LgDeplacementStatus.LIQUIDATION_VALIDEE;
      }

      if (newDeplacementStatus) {
        await tx.lgDeplacement.update({
          where: { id: deplacementId },
          data: { status: newDeplacementStatus },
        });
      }

      return {
        decision,
        role,
        deplacementStatus: newDeplacementStatus ?? dep.status,
        allValidated,
        hasRejection,
      };
    });

    await this.dispatchDecisionNotifications(dep, result);

    return {
      validations:
        await this.validationRepository.findValidationsByLiquidationId(
          liquidationId,
        ),
      deplacementStatus: result.deplacementStatus,
    };
  }

  /**
   * Notifications non bloquantes après une décision.
   */
  private async dispatchDecisionNotifications(
    dep: {
      id: string;
      reference: string;
      requestor?: { email: string | null } | null;
    },
    result: {
      role: LgLiquidationValidatorRole;
      hasRejection: boolean;
      allValidated: boolean;
    },
  ) {
    try {
      if (result.hasRejection) {
        // Rejet -> notifier le demandeur pour resoumission
        if (dep.requestor?.email) {
          await this.notificationService.createNotification(
            OSDRM_PROCESS_EVENT.LIQUIDATION_REJETEE,
            [dep.requestor.email],
            dep.id,
            { reference: dep.reference, role: result.role },
            false,
          );
        }
        return;
      }

      if (result.allValidated) {
        // Validation complète -> gestionnaires/admin + demandeur
        const gestionnaires = await this.prisma.user.findMany({
          where: {
            role: { in: [Role.GESTIONNAIRE_PARC, Role.ADMIN] },
            isActive: true,
          },
          select: { email: true },
        });
        const emails = gestionnaires.map((u) => u.email).filter(Boolean);
        if (dep.requestor?.email) emails.push(dep.requestor.email);
        const unique = [...new Set(emails)];
        if (unique.length) {
          await this.notificationService.createNotification(
            OSDRM_PROCESS_EVENT.LIQUIDATION_VALIDEE_COMPLETE,
            unique,
            dep.id,
            { reference: dep.reference },
            false,
          );
        }
      }
    } catch {
      // Notification failure must not roll back the decision
    }
  }

  /**
   * Notifie les valideurs concernés à la soumission / resoumission (non bloquant).
   * Appelée par DeplacementLiquidationService après commit.
   */
  async notifyValidationRequired(dep: {
    id: string;
    reference: string;
    requestorId: number | null;
    requestor?: { email: string | null } | null;
  }) {
    try {
      const validators = await this.prisma.user.findMany({
        where: { role: { in: [Role.OM, Role.CFO] }, isActive: true },
        select: { email: true },
      });
      const emails = validators.map((u) => u.email).filter(Boolean);
      if (dep.requestor?.email) emails.push(dep.requestor.email);
      const unique = [...new Set(emails)];
      if (unique.length) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.LIQUIDATION_VALIDATION_REQUISE,
          unique,
          dep.id,
          { reference: dep.reference },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back liquidation submission
    }
  }
}
