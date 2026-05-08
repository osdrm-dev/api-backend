import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  OperationType,
  PurchaseStatus,
  PurchaseStep,
  Role,
} from '@prisma/client';
import { ItAssetRepository } from 'src/repository/parc-informatique/it-asset.repository';
import { ItDemandRepository } from 'src/repository/parc-informatique/it-demand.repository';
import { BudgetTableService } from 'src/budget/services/budget-table.service';
import { TriggerDaDto } from '../dto/trigger-da.dto';

@Injectable()
export class ItTriggerDaService {
  constructor(
    private readonly assetRepository: ItAssetRepository,
    private readonly demandRepository: ItDemandRepository,
    private readonly prisma: PrismaService,
    private readonly budgetTableService: BudgetTableService,
  ) {}

  async triggerForAsset(
    assetId: string,
    adminUserId: number,
    dto: TriggerDaDto,
  ) {
    const asset = await this.assetRepository.findById(assetId);
    if (!asset || asset.archivedAt !== null) {
      throw new NotFoundException('Actif informatique introuvable.');
    }
    if (asset.linkedPurchaseId) {
      throw new ConflictException('Une DA est déjà liée à cet actif.');
    }

    const acheteur = await this.prisma.user.findUnique({
      where: { id: dto.acheteurId },
      select: { id: true, role: true, isActive: true },
    });
    if (!acheteur || acheteur.role !== Role.ACHETEUR || !acheteur.isActive) {
      throw new NotFoundException(
        "L'acheteur spécifié est introuvable ou inactif.",
      );
    }

    const project = await this.budgetTableService.getActiveProjectInternal(
      dto.projectCode,
    );

    const year = new Date().getFullYear();

    const result = await this.prisma.$transaction(async (tx) => {
      const count = await tx.purchase.count({ where: { year } });
      const sequentialNumber = String(count + 1).padStart(4, '0');
      const reference = `DA-${year}-${sequentialNumber}`;

      const purchase = await tx.purchase.create({
        data: {
          reference,
          year,
          sequentialNumber,
          operationType: OperationType.OPERATION,
          title: dto.title ?? asset.designation,
          description:
            dto.description ?? `Actif informatique : ${asset.designation}`,
          justification: `Actif informatique ${asset.id}`,
          project: project.projectName,
          projectCode: project.projectCode,
          grantCode: project.grantCode,
          activityCode: project.activityCode,
          costCenter: project.costCenter,
          region: project.region,
          site: project.site,
          status: PurchaseStatus.DRAFT,
          currentStep: PurchaseStep.DA,
          creatorId: adminUserId,
          acheteurId: dto.acheteurId,
          data: { itAssetId: assetId },
        },
      });

      await tx.itAsset.update({
        where: { id: assetId },
        data: { linkedPurchaseId: purchase.id },
      });

      return { purchaseId: purchase.id, reference: purchase.reference };
    });

    return result;
  }

  async triggerForDemand(
    demandId: string,
    adminUserId: number,
    dto: TriggerDaDto,
  ) {
    const demand = await this.demandRepository.findById(demandId);
    if (!demand) {
      throw new NotFoundException('Demande informatique introuvable.');
    }
    if (demand.linkedPurchaseId) {
      throw new ConflictException('Une DA est déjà liée à cette demande.');
    }

    const acheteur = await this.prisma.user.findUnique({
      where: { id: dto.acheteurId },
      select: { id: true, role: true, isActive: true },
    });
    if (!acheteur || acheteur.role !== Role.ACHETEUR || !acheteur.isActive) {
      throw new NotFoundException(
        "L'acheteur spécifié est introuvable ou inactif.",
      );
    }

    const project = await this.budgetTableService.getActiveProjectInternal(
      dto.projectCode,
    );

    const year = new Date().getFullYear();

    const result = await this.prisma.$transaction(async (tx) => {
      const count = await tx.purchase.count({ where: { year } });
      const sequentialNumber = String(count + 1).padStart(4, '0');
      const reference = `DA-${year}-${sequentialNumber}`;

      const purchase = await tx.purchase.create({
        data: {
          reference,
          year,
          sequentialNumber,
          operationType: OperationType.OPERATION,
          title: dto.title ?? `Demande informatique ${demand.reference}`,
          description: dto.description ?? demand.justification,
          justification: `Demande informatique ${demand.reference}`,
          project: project.projectName,
          projectCode: project.projectCode,
          grantCode: project.grantCode,
          activityCode: project.activityCode,
          costCenter: project.costCenter,
          region: project.region,
          site: project.site,
          status: PurchaseStatus.DRAFT,
          currentStep: PurchaseStep.DA,
          creatorId: demand.requestorId ?? adminUserId,
          acheteurId: dto.acheteurId,
          data: { itDemandId: demandId },
        },
      });

      await tx.itDemand.update({
        where: { id: demandId },
        data: { linkedPurchaseId: purchase.id },
      });

      return { purchaseId: purchase.id, reference: purchase.reference };
    });

    return result;
  }
}
