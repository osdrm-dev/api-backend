import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { PrismaService } from 'prisma/prisma.service';
import {
  OperationType,
  PurchaseStatus,
  PurchaseStep,
  Role,
} from '@prisma/client';
import { EquipmentRepository } from 'src/repository/inventory/equipment.repository';
import { EquipmentDemandRepository } from 'src/repository/inventory/equipment-demand.repository';
import { BudgetTableService } from 'src/budget/services/budget-table.service';
import { TriggerDaDto } from '../dto/trigger-da.dto';

@Injectable()
export class EquipmentTriggerDaService {
  constructor(
    private readonly assetRepository: EquipmentRepository,
    private readonly demandRepository: EquipmentDemandRepository,
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment not found',
      );
    }
    if (asset.linkedPurchaseId) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.EQUIPMENT_DA_ALREADY_LINKED,
        'A purchase request is already linked to this asset',
      );
    }

    const acheteur = await this.prisma.user.findUnique({
      where: { id: dto.acheteurId },
      select: { id: true, role: true, isActive: true },
    });
    if (!acheteur || acheteur.role !== Role.ACHETEUR || !acheteur.isActive) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.PURCHASE_BUYER_INVALID,
        'Specified buyer not found or inactive',
        {
          fields: [
            { field: 'acheteurId', code: ErrorCode.PURCHASE_BUYER_INVALID },
          ],
        },
      );
    }

    const project = await this.budgetTableService.getActiveProjectInternal(
      dto.activityCode,
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
          description: dto.description ?? `Matériel : ${asset.designation}`,
          justification: `Matériel ${asset.inventoryReference ?? asset.id}`,
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
          data: { equipmentId: assetId },
        },
      });

      await tx.equipment.update({
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment demand not found',
      );
    }
    if (demand.linkedPurchaseId) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.EQUIPMENT_DEMAND_DA_ALREADY_LINKED,
        'A purchase request is already linked to this demand',
      );
    }

    const acheteur = await this.prisma.user.findUnique({
      where: { id: dto.acheteurId },
      select: { id: true, role: true, isActive: true },
    });
    if (!acheteur || acheteur.role !== Role.ACHETEUR || !acheteur.isActive) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.PURCHASE_BUYER_INVALID,
        'Specified buyer not found or inactive',
        {
          fields: [
            { field: 'acheteurId', code: ErrorCode.PURCHASE_BUYER_INVALID },
          ],
        },
      );
    }

    const project = await this.budgetTableService.getActiveProjectInternal(
      dto.activityCode,
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
          title: dto.title ?? `Demande de matériel ${demand.reference}`,
          description: dto.description ?? demand.justification,
          justification: `Demande de matériel ${demand.reference}`,
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
          data: { equipmentDemandId: demandId },
        },
      });

      await tx.equipmentDemand.update({
        where: { id: demandId },
        data: { linkedPurchaseId: purchase.id },
      });

      return { purchaseId: purchase.id, reference: purchase.reference };
    });

    return result;
  }
}
