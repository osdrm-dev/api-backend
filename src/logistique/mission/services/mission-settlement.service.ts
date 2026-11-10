import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  LgMissionStatus,
  LgSettlementValidationStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { CreateSettlementDto } from '../dto/create-settlement.dto';
import { ResubmitSettlementDto } from '../dto/resubmit-settlement.dto';
import {
  CurrentUser,
  SettlementValidationService,
} from './settlement-validation.service';

const SETTLEMENT_ALLOWED_STATUSES: string[] = [
  LgMissionStatus.CONFIRMED,
  LgMissionStatus.IN_PROGRESS,
];

@Injectable()
export class MissionSettlementService {
  constructor(
    private readonly repository: MissionRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly validationService: SettlementValidationService,
  ) {}

  async submit(id: string, dto: CreateSettlementDto, submittedById: number) {
    const mission = await this.repository.findById(id);
    if (!mission) throw new NotFoundException(`Trajet ${id} introuvable.`);

    if (!SETTLEMENT_ALLOWED_STATUSES.includes(mission.status)) {
      throw new UnprocessableEntityException(
        `La liquidation n'est possible que pour les trajets en statut CONFIRMED ou IN_PROGRESS (statut actuel : ${mission.status}).`,
      );
    }

    if (mission.settlement) {
      throw new ConflictException(
        'Une liquidation a déjà été soumise pour ce trajet.',
      );
    }

    const transportCost = new Prisma.Decimal(dto.transportCost);
    const accommodationCost = new Prisma.Decimal(dto.accommodationCost);
    const mealCost = new Prisma.Decimal(dto.mealCost);
    const otherCosts = new Prisma.Decimal(dto.otherCosts ?? 0);
    const totalAmount = transportCost
      .add(accommodationCost)
      .add(mealCost)
      .add(otherCosts);

    const settlement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lgMissionSettlement.create({
        data: {
          missionId: id,
          transportCost,
          accommodationCost,
          mealCost,
          otherCosts,
          totalAmount,
          remarks: dto.remarks,
          submittedById,
        },
      });

      // FR-4 : créer les 3 lignes de validation dans la même transaction
      await this.validationService.createValidationRows(tx, created.id);

      // FR-5 : statut SETTLED = "soumise, validation en cours"
      await tx.lgMission.update({
        where: { id },
        data: { status: LgMissionStatus.SETTLED },
      });

      return created;
    });

    try {
      const managers = await this.prisma.user.findMany({
        where: { role: Role.GESTIONNAIRE_PARC, isActive: true },
        select: { email: true },
      });
      const emails = managers.map((u) => u.email).filter(Boolean);
      if (emails.length) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.MISSION_SETTLED,
          emails,
          id,
          {
            reference: mission.reference,
            totalAmount: totalAmount.toNumber(),
          },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back settlement
    }

    // T3.5 : notifier les valideurs (OM/CFO + demandeur) — non bloquant
    await this.validationService.notifyValidationRequired(mission);

    return settlement;
  }

  /**
   * Resoumission d'une liquidation rejetée par le DEMANDEUR (auteur).
   * - Exige au moins une ligne REJECTED (FR-16).
   * - Met à jour les montants/observations.
   * - Réinitialise les 3 lignes à PENDING (reset complet, FR-15) et repasse
   *   le trajet à SETTLED, le tout dans une transaction.
   */
  async resubmit(
    id: string,
    dto: ResubmitSettlementDto,
    currentUser: CurrentUser,
  ) {
    const mission = await this.repository.findById(id);
    if (!mission) throw new NotFoundException(`Trajet ${id} introuvable.`);

    if (!mission.settlement) {
      throw new NotFoundException('Aucune liquidation soumise pour ce trajet.');
    }

    // Seul l'auteur (requestor) ou un ADMIN peut resoumettre.
    if (
      currentUser.role !== Role.ADMIN &&
      mission.requestorId !== currentUser.id
    ) {
      throw new ForbiddenException(
        'Seul le demandeur peut resoumettre sa liquidation.',
      );
    }

    const validations = mission.settlement.validations ?? [];
    const hasRejection = validations.some(
      (v) => v.status === LgSettlementValidationStatus.REJECTED,
    );
    if (!hasRejection) {
      throw new UnprocessableEntityException(
        'La liquidation est en cours de validation, aucune resoumission possible.',
      );
    }

    const transportCost = new Prisma.Decimal(dto.transportCost);
    const accommodationCost = new Prisma.Decimal(dto.accommodationCost);
    const mealCost = new Prisma.Decimal(dto.mealCost);
    const otherCosts = new Prisma.Decimal(dto.otherCosts ?? 0);
    const totalAmount = transportCost
      .add(accommodationCost)
      .add(mealCost)
      .add(otherCosts);

    const settlementId = mission.settlement.id;

    const settlement = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lgMissionSettlement.update({
        where: { id: settlementId },
        data: {
          transportCost,
          accommodationCost,
          mealCost,
          otherCosts,
          totalAmount,
          remarks: dto.remarks,
          submittedById: currentUser.id,
          submittedAt: new Date(),
        },
      });

      // FR-15 : reset complet des 3 lignes
      await this.validationService.resubmitReset(tx, settlementId);

      // Le trajet repasse à SETTLED
      await tx.lgMission.update({
        where: { id },
        data: { status: LgMissionStatus.SETTLED },
      });

      return updated;
    });

    // T3.5 : re-notifier les valideurs — non bloquant
    await this.validationService.notifyValidationRequired(mission);

    return settlement;
  }

  async getSettlement(id: string) {
    const mission = await this.repository.findById(id);
    if (!mission) throw new NotFoundException(`Trajet ${id} introuvable.`);
    if (!mission.settlement)
      throw new NotFoundException('Aucune liquidation soumise pour ce trajet.');
    return mission.settlement;
  }
}
