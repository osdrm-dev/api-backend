import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  LgDeplacementStatus,
  LgLiquidationValidationStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { CreateLiquidationDto } from '../dto/create-liquidation.dto';
import { ResubmitLiquidationDto } from '../dto/resubmit-liquidation.dto';
import {
  CurrentUser,
  LiquidationValidationService,
} from './deplacement-liquidation-validation.service';

const LIQUIDATION_ALLOWED_STATUSES: string[] = [
  LgDeplacementStatus.CONFIRMEE,
  LgDeplacementStatus.EN_COURS,
];

@Injectable()
export class DeplacementLiquidationService {
  constructor(
    private readonly repository: DeplacementRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly validationService: LiquidationValidationService,
  ) {}

  async submit(id: string, dto: CreateLiquidationDto, submittedById: number) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Déplacement ${id} introuvable.`);

    if (!LIQUIDATION_ALLOWED_STATUSES.includes(dep.status)) {
      throw new UnprocessableEntityException(
        `La liquidation n'est possible que pour les déplacements en statut CONFIRMEE ou EN_COURS (statut actuel : ${dep.status}).`,
      );
    }

    if (dep.liquidation) {
      throw new ConflictException(
        'Une liquidation a déjà été soumise pour ce déplacement.',
      );
    }

    const fraisTransport = new Prisma.Decimal(dto.fraisTransport);
    const fraisHebergement = new Prisma.Decimal(dto.fraisHebergement);
    const fraisRestauration = new Prisma.Decimal(dto.fraisRestauration);
    const autresFrais = new Prisma.Decimal(dto.autresFrais ?? 0);
    const totalLiquidation = fraisTransport
      .add(fraisHebergement)
      .add(fraisRestauration)
      .add(autresFrais);

    const liquidation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lgDeplacementLiquidation.create({
        data: {
          deplacementId: id,
          fraisTransport,
          fraisHebergement,
          fraisRestauration,
          autresFrais,
          totalLiquidation,
          observations: dto.observations,
          submittedById,
        },
      });

      // FR-4 : créer les 3 lignes de validation dans la même transaction
      await this.validationService.createValidationRows(tx, created.id);

      // FR-5 : statut LIQUIDEE = "soumise, validation en cours"
      await tx.lgDeplacement.update({
        where: { id },
        data: { status: LgDeplacementStatus.LIQUIDEE },
      });

      return created;
    });

    try {
      const gestionnaires = await this.prisma.user.findMany({
        where: { role: Role.GESTIONNAIRE_PARC, isActive: true },
        select: { email: true },
      });
      const emails = gestionnaires.map((u) => u.email).filter(Boolean);
      if (emails.length) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.DEPLACEMENT_LIQUIDE,
          emails,
          id,
          {
            reference: dep.reference,
            totalLiquidation: totalLiquidation.toNumber(),
          },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back liquidation
    }

    // T3.5 : notifier les valideurs (OM/CFO + demandeur) — non bloquant
    await this.validationService.notifyValidationRequired(dep);

    return liquidation;
  }

  /**
   * Resoumission d'une liquidation rejetée par le DEMANDEUR (auteur).
   * - Exige au moins une ligne REJETEE (FR-16).
   * - Met à jour les montants/observations.
   * - Réinitialise les 3 lignes à EN_ATTENTE (reset complet, FR-15) et repasse
   *   le déplacement à LIQUIDEE, le tout dans une transaction.
   */
  async resubmit(
    id: string,
    dto: ResubmitLiquidationDto,
    currentUser: CurrentUser,
  ) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Déplacement ${id} introuvable.`);

    if (!dep.liquidation) {
      throw new NotFoundException(
        'Aucune liquidation soumise pour ce déplacement.',
      );
    }

    // Seul l'auteur (requestor) ou un ADMIN peut resoumettre.
    if (currentUser.role !== Role.ADMIN && dep.requestorId !== currentUser.id) {
      throw new ForbiddenException(
        'Seul le demandeur peut resoumettre sa liquidation.',
      );
    }

    const validations = dep.liquidation.validations ?? [];
    const hasRejection = validations.some(
      (v) => v.status === LgLiquidationValidationStatus.REJETEE,
    );
    if (!hasRejection) {
      throw new UnprocessableEntityException(
        'La liquidation est en cours de validation, aucune resoumission possible.',
      );
    }

    const fraisTransport = new Prisma.Decimal(dto.fraisTransport);
    const fraisHebergement = new Prisma.Decimal(dto.fraisHebergement);
    const fraisRestauration = new Prisma.Decimal(dto.fraisRestauration);
    const autresFrais = new Prisma.Decimal(dto.autresFrais ?? 0);
    const totalLiquidation = fraisTransport
      .add(fraisHebergement)
      .add(fraisRestauration)
      .add(autresFrais);

    const liquidationId = dep.liquidation.id;

    const liquidation = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lgDeplacementLiquidation.update({
        where: { id: liquidationId },
        data: {
          fraisTransport,
          fraisHebergement,
          fraisRestauration,
          autresFrais,
          totalLiquidation,
          observations: dto.observations,
          submittedById: currentUser.id,
          dateDepotLiquidation: new Date(),
        },
      });

      // FR-15 : reset complet des 3 lignes
      await this.validationService.resubmitReset(tx, liquidationId);

      // Le déplacement repasse à LIQUIDEE
      await tx.lgDeplacement.update({
        where: { id },
        data: { status: LgDeplacementStatus.LIQUIDEE },
      });

      return updated;
    });

    // T3.5 : re-notifier les valideurs — non bloquant
    await this.validationService.notifyValidationRequired(dep);

    return liquidation;
  }

  async getLiquidation(id: string) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Déplacement ${id} introuvable.`);
    if (!dep.liquidation)
      throw new NotFoundException(
        'Aucune liquidation soumise pour ce déplacement.',
      );
    return dep.liquidation;
  }
}
