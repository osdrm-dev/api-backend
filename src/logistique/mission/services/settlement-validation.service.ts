import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  LgMissionStatus,
  LgSettlementValidationStatus,
  LgSettlementValidatorRole,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { SettlementValidationRepository } from 'src/repository/mission/settlement-validation.repository';

export interface CurrentUser {
  id: number;
  role: string;
}

const DECIDABLE_STATUSES: LgSettlementValidationStatus[] = [
  LgSettlementValidationStatus.APPROVED,
  LgSettlementValidationStatus.REJECTED,
];

const BLOCKED_MISSION_STATUSES: string[] = [
  LgMissionStatus.CANCELLED,
  LgMissionStatus.REJECTED,
];

@Injectable()
export class SettlementValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly missionRepository: MissionRepository,
    private readonly validationRepository: SettlementValidationRepository,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Crée les 3 lignes de validation dans une transaction existante.
   * Appelée par MissionSettlementService.submit / resubmit.
   */
  async createValidationRows(
    tx: Prisma.TransactionClient,
    settlementId: string,
  ) {
    return this.validationRepository.createValidationRows(tx, settlementId);
  }

  /**
   * Réinitialise les 3 lignes à PENDING (reset complet) dans une transaction.
   */
  async resubmitReset(tx: Prisma.TransactionClient, settlementId: string) {
    return this.validationRepository.resetValidations(tx, settlementId);
  }

  /**
   * Détail des 3 validations d'une liquidation (FR-17).
   */
  async getValidationDetail(missionId: string) {
    const mission = await this.missionRepository.findById(missionId);
    if (!mission)
      throw new NotFoundException(`Trajet ${missionId} introuvable.`);
    if (!mission.settlement)
      throw new NotFoundException('Aucune liquidation soumise pour ce trajet.');
    return this.validationRepository.findValidationsBySettlementId(
      mission.settlement.id,
    );
  }

  /**
   * Déduit le rôle-validateur ciblé à partir du rôle global de l'utilisateur.
   * Pour l'ADMIN, le rôle doit être fourni explicitement (explicitRole).
   */
  resolveTargetRole(
    currentUser: CurrentUser,
    explicitRole?: LgSettlementValidatorRole,
  ): LgSettlementValidatorRole {
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
        return LgSettlementValidatorRole.DEMANDEUR;
      case Role.OM:
        return LgSettlementValidatorRole.OM;
      case Role.CFO:
        return LgSettlementValidatorRole.CFO;
      default:
        throw new ForbiddenException(
          'Votre rôle ne vous autorise pas à valider une liquidation.',
        );
    }
  }

  /**
   * Vérifie que l'utilisateur courant peut décider sur la ligne `role`
   * du trajet donné (FR-8/9/10 + cas requestorId null).
   */
  private assertCanDecide(
    role: LgSettlementValidatorRole,
    currentUser: CurrentUser,
    mission: { requestorId: number | null },
  ) {
    const isAdmin = currentUser.role === Role.ADMIN;

    if (role === LgSettlementValidatorRole.DEMANDEUR) {
      if (mission.requestorId == null) {
        throw new UnprocessableEntityException(
          "Le demandeur d'origine n'est plus actif, contactez un administrateur.",
        );
      }
      if (!isAdmin && currentUser.id !== mission.requestorId) {
        throw new ForbiddenException(
          "Seul l'auteur de la demande peut valider la ligne DEMANDEUR.",
        );
      }
      return;
    }

    if (role === LgSettlementValidatorRole.OM) {
      if (!isAdmin && currentUser.role !== Role.OM) {
        throw new ForbiddenException(
          'Seul un utilisateur OM peut valider la ligne OM.',
        );
      }
      return;
    }

    if (role === LgSettlementValidatorRole.CFO) {
      if (!isAdmin && currentUser.role !== Role.CFO) {
        throw new ForbiddenException(
          'Seul un utilisateur CFO peut valider la ligne CFO.',
        );
      }
      return;
    }
  }

  /**
   * Enregistre la décision (APPROVED/REJECTED) d'un valideur sur une ligne,
   * met à jour le statut du trajet le cas échéant, le tout dans une
   * transaction avec relecture de l'état (concurrence — Edge Cases).
   */
  async decide(
    missionId: string,
    role: LgSettlementValidatorRole,
    decision: LgSettlementValidationStatus,
    comment: string | undefined,
    currentUser: CurrentUser,
  ) {
    if (!DECIDABLE_STATUSES.includes(decision)) {
      throw new UnprocessableEntityException(
        'La décision doit être APPROVED ou REJECTED.',
      );
    }

    const mission = await this.missionRepository.findById(missionId);
    if (!mission)
      throw new NotFoundException(`Trajet ${missionId} introuvable.`);

    if (BLOCKED_MISSION_STATUSES.includes(mission.status)) {
      throw new UnprocessableEntityException(
        `Aucune validation possible : le trajet est en statut ${mission.status}.`,
      );
    }

    if (!mission.settlement) {
      throw new NotFoundException('Aucune liquidation soumise pour ce trajet.');
    }

    this.assertCanDecide(role, currentUser, mission);

    const settlementId = mission.settlement.id;

    const result = await this.prisma.$transaction(async (tx) => {
      // Relecture de l'état dans la transaction (concurrence)
      const rows = await this.validationRepository.findValidationsForUpdate(
        tx,
        settlementId,
      );
      const target = rows.find((r) => r.role === role);
      if (!target) {
        throw new NotFoundException(
          `Ligne de validation ${role} introuvable pour cette liquidation.`,
        );
      }
      if (target.status !== LgSettlementValidationStatus.PENDING) {
        throw new ConflictException('Cette validation a déjà été traitée.');
      }

      await this.validationRepository.updateValidationDecision(tx, target.id, {
        status: decision,
        validatorId: currentUser.id,
        comment,
      });

      // Recalcul de l'état après mise à jour de la ligne ciblée
      const updatedRows = rows.map((r) =>
        r.id === target.id ? { ...r, status: decision } : r,
      );

      let newMissionStatus: LgMissionStatus | null = null;

      const hasRejection = updatedRows.some(
        (r) => r.status === LgSettlementValidationStatus.REJECTED,
      );
      const allValidated = updatedRows.every(
        (r) => r.status === LgSettlementValidationStatus.APPROVED,
      );

      if (
        hasRejection &&
        mission.status !== LgMissionStatus.SETTLEMENT_REJECTED
      ) {
        newMissionStatus = LgMissionStatus.SETTLEMENT_REJECTED;
      } else if (allValidated) {
        newMissionStatus = LgMissionStatus.SETTLEMENT_APPROVED;
      }

      if (newMissionStatus) {
        await tx.lgMission.update({
          where: { id: missionId },
          data: { status: newMissionStatus },
        });
      }

      return {
        decision,
        role,
        missionStatus: newMissionStatus ?? mission.status,
        allValidated,
        hasRejection,
      };
    });

    await this.dispatchDecisionNotifications(mission, result);

    return {
      validations:
        await this.validationRepository.findValidationsBySettlementId(
          settlementId,
        ),
      missionStatus: result.missionStatus,
    };
  }

  /**
   * Notifications non bloquantes après une décision.
   */
  private async dispatchDecisionNotifications(
    mission: {
      id: string;
      reference: string;
      requestor?: { email: string | null } | null;
    },
    result: {
      role: LgSettlementValidatorRole;
      hasRejection: boolean;
      allValidated: boolean;
    },
  ) {
    try {
      if (result.hasRejection) {
        // Rejet -> notifier le demandeur pour resoumission
        if (mission.requestor?.email) {
          await this.notificationService.createNotification(
            OSDRM_PROCESS_EVENT.SETTLEMENT_REJECTED,
            [mission.requestor.email],
            mission.id,
            { reference: mission.reference, role: result.role },
            false,
          );
        }
        return;
      }

      if (result.allValidated) {
        // Validation complète -> gestionnaires/admin + demandeur
        const managers = await this.prisma.user.findMany({
          where: {
            role: { in: [Role.GESTIONNAIRE_PARC, Role.ADMIN] },
            isActive: true,
          },
          select: { email: true },
        });
        const emails = managers.map((u) => u.email).filter(Boolean);
        if (mission.requestor?.email) emails.push(mission.requestor.email);
        const unique = [...new Set(emails)];
        if (unique.length) {
          await this.notificationService.createNotification(
            OSDRM_PROCESS_EVENT.SETTLEMENT_APPROVED,
            unique,
            mission.id,
            { reference: mission.reference },
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
   * Appelée par MissionSettlementService après commit.
   */
  async notifyValidationRequired(mission: {
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
      if (mission.requestor?.email) emails.push(mission.requestor.email);
      const unique = [...new Set(emails)];
      if (unique.length) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.SETTLEMENT_VALIDATION_REQUIRED,
          unique,
          mission.id,
          { reference: mission.reference },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back settlement submission
    }
  }
}
