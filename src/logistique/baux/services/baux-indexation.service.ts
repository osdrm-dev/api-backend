import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BauxRepository } from 'src/repository/baux/baux.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { Prisma } from '@prisma/client';

@Injectable()
export class BauxIndexationService {
  private readonly logger = new Logger(BauxIndexationService.name);

  constructor(
    private readonly repository: BauxRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async applyIndexation(currentMonth: number): Promise<void> {
    const contracts =
      await this.repository.findContractsForIndexation(currentMonth);

    if (contracts.length === 0) {
      this.logger.log('[BAUX INDEXATION] Aucun contrat à indexer ce mois.');
      return;
    }

    const year = new Date().getFullYear();

    for (const contract of contracts) {
      try {
        const rate = new Prisma.Decimal(contract.indexationRate as any);
        const current = new Prisma.Decimal(contract.montantMensuel as any);
        const newMontant = current.mul(
          new Prisma.Decimal(1).add(rate.div(100)),
        );
        const newMontantStr = newMontant.toDecimalPlaces(2).toString();

        await this.prisma.$transaction([
          this.prisma.lgBailContract.update({
            where: { id: contract.id },
            data: { montantMensuel: newMontantStr },
          }),
          this.prisma.lgBailAvenant.create({
            data: {
              contractId: contract.id,
              numero: `INDEXATION-${year}`,
              description: `Indexation annuelle ${year} — taux ${rate.toString()}% appliqué. Ancien montant : ${current.toString()}, nouveau : ${newMontantStr}.`,
              nouveauMontant: newMontantStr,
            },
          }),
        ]);

        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.BAIL_INDEXATION_APPLIED,
          [],
          contract.id,
          {
            contractId: contract.id,
            reference: contract.reference,
            ancienMontant: current.toString(),
            nouveauMontant: newMontantStr,
            taux: rate.toString(),
          },
        );

        this.logger.log(
          `[BAUX INDEXATION] Contrat ${contract.reference} indexé : ${current} → ${newMontantStr}`,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[BAUX INDEXATION] Erreur contrat ${contract.reference} : ${msg}`,
        );
      }
    }
  }
}
