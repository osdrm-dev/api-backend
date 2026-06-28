import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  Prisma,
  LgLiquidationValidatorRole,
  LgLiquidationValidationStatus,
} from '@prisma/client';

const VALIDATION_INCLUDE = {
  validator: {
    select: { id: true, name: true, email: true, role: true },
  },
} satisfies Prisma.LgLiquidationValidationInclude;

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class LiquidationValidationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée les 3 lignes de validation (DEMANDEUR, OM, CFO) à EN_ATTENTE.
   * Doit être appelée dans une transaction existante (tx) pour rester cohérent
   * avec la création de la liquidation.
   */
  createValidationRows(tx: PrismaTx, liquidationId: string) {
    const roles: LgLiquidationValidatorRole[] = [
      LgLiquidationValidatorRole.DEMANDEUR,
      LgLiquidationValidatorRole.OM,
      LgLiquidationValidatorRole.CFO,
    ];
    return tx.lgLiquidationValidation.createMany({
      data: roles.map((role) => ({
        liquidationId,
        role,
        status: LgLiquidationValidationStatus.EN_ATTENTE,
      })),
    });
  }

  findValidationsByLiquidationId(liquidationId: string) {
    return this.prisma.lgLiquidationValidation.findMany({
      where: { liquidationId },
      orderBy: { role: 'asc' },
      include: VALIDATION_INCLUDE,
    });
  }

  findValidationByLiquidationAndRole(
    liquidationId: string,
    role: LgLiquidationValidatorRole,
    tx?: PrismaTx,
  ) {
    const client = tx ?? this.prisma;
    return client.lgLiquidationValidation.findUnique({
      where: { liquidationId_role: { liquidationId, role } },
      include: VALIDATION_INCLUDE,
    });
  }

  updateValidationDecision(
    tx: PrismaTx,
    validationId: string,
    data: {
      status: LgLiquidationValidationStatus;
      validatorId: number;
      commentaire?: string | null;
    },
  ) {
    return tx.lgLiquidationValidation.update({
      where: { id: validationId },
      data: {
        status: data.status,
        validatorId: data.validatorId,
        commentaire: data.commentaire ?? null,
        decidedAt: new Date(),
      },
    });
  }

  /**
   * Réinitialise les 3 lignes à EN_ATTENTE (reset complet) lors d'une resoumission.
   */
  resetValidations(tx: PrismaTx, liquidationId: string) {
    return tx.lgLiquidationValidation.updateMany({
      where: { liquidationId },
      data: {
        status: LgLiquidationValidationStatus.EN_ATTENTE,
        validatorId: null,
        commentaire: null,
        decidedAt: null,
      },
    });
  }

  /**
   * Compte les lignes par statut pour une liquidation (relecture dans une transaction).
   */
  findValidationsForUpdate(tx: PrismaTx, liquidationId: string) {
    return tx.lgLiquidationValidation.findMany({
      where: { liquidationId },
      select: { id: true, role: true, status: true },
    });
  }
}
