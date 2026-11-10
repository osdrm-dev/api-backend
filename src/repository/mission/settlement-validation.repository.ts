import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  Prisma,
  LgSettlementValidatorRole,
  LgSettlementValidationStatus,
} from '@prisma/client';

const VALIDATION_INCLUDE = {
  validator: {
    select: { id: true, name: true, email: true, role: true },
  },
} satisfies Prisma.LgSettlementValidationInclude;

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class SettlementValidationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée les 3 lignes de validation (DEMANDEUR, OM, CFO) à PENDING.
   * Doit être appelée dans une transaction existante (tx) pour rester cohérent
   * avec la création de la settlement.
   */
  createValidationRows(tx: PrismaTx, settlementId: string) {
    const roles: LgSettlementValidatorRole[] = [
      LgSettlementValidatorRole.DEMANDEUR,
      LgSettlementValidatorRole.OM,
      LgSettlementValidatorRole.CFO,
    ];
    return tx.lgSettlementValidation.createMany({
      data: roles.map((role) => ({
        settlementId,
        role,
        status: LgSettlementValidationStatus.PENDING,
      })),
    });
  }

  findValidationsBySettlementId(settlementId: string) {
    return this.prisma.lgSettlementValidation.findMany({
      where: { settlementId },
      orderBy: { role: 'asc' },
      include: VALIDATION_INCLUDE,
    });
  }

  findValidationBySettlementAndRole(
    settlementId: string,
    role: LgSettlementValidatorRole,
    tx?: PrismaTx,
  ) {
    const client = tx ?? this.prisma;
    return client.lgSettlementValidation.findUnique({
      where: { settlementId_role: { settlementId, role } },
      include: VALIDATION_INCLUDE,
    });
  }

  updateValidationDecision(
    tx: PrismaTx,
    validationId: string,
    data: {
      status: LgSettlementValidationStatus;
      validatorId: number;
      comment?: string | null;
    },
  ) {
    return tx.lgSettlementValidation.update({
      where: { id: validationId },
      data: {
        status: data.status,
        validatorId: data.validatorId,
        comment: data.comment ?? null,
        decidedAt: new Date(),
      },
    });
  }

  /**
   * Réinitialise les 3 lignes à PENDING (reset complet) lors d'une resoumission.
   */
  resetValidations(tx: PrismaTx, settlementId: string) {
    return tx.lgSettlementValidation.updateMany({
      where: { settlementId },
      data: {
        status: LgSettlementValidationStatus.PENDING,
        validatorId: null,
        comment: null,
        decidedAt: null,
      },
    });
  }

  /**
   * Compte les lignes par statut pour une liquidation (relecture dans une transaction).
   */
  findValidationsForUpdate(tx: PrismaTx, settlementId: string) {
    return tx.lgSettlementValidation.findMany({
      where: { settlementId },
      select: { id: true, role: true, status: true },
    });
  }
}
