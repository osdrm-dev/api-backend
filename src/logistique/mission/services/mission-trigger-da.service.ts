import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { PrismaService } from 'prisma/prisma.service';
import {
  OperationType,
  PurchaseStatus,
  PurchaseStep,
  Role,
} from '@prisma/client';
import { BudgetTableService } from 'src/budget/services/budget-table.service';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { TriggerDaMissionDto } from '../dto/trigger-da-mission.dto';

@Injectable()
export class MissionTriggerDaService {
  constructor(
    private readonly repository: MissionRepository,
    private readonly prisma: PrismaService,
    private readonly budgetTableService: BudgetTableService,
  ) {}

  async triggerDA(id: string, dto: TriggerDaMissionDto, managerId: number) {
    const mission = await this.repository.findById(id);
    if (!mission)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Mission ${id} not found`,
      );

    if (mission.linkedPurchaseId) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.MISSION_DA_ALREADY_LINKED,
        'A purchase request is already linked to this mission',
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
          title: dto.title ?? `Location véhicule - ${mission.reference}`,
          description:
            dto.description ??
            `Trajet ${mission.reference} : ${mission.purpose} vers ${mission.destination}`,
          justification: `Trajet ${mission.reference}`,
          project: project.projectName,
          projectCode: project.projectCode,
          grantCode: project.grantCode,
          activityCode: project.activityCode,
          costCenter: project.costCenter,
          region: project.region,
          site: project.site,
          status: PurchaseStatus.DRAFT,
          currentStep: PurchaseStep.DA,
          creatorId: managerId,
          acheteurId: dto.acheteurId,
          data: { missionId: id },
        },
      });

      await tx.lgMission.update({
        where: { id },
        data: {
          linkedPurchaseId: purchase.id,
          status: 'PENDING_RENTAL',
        },
      });

      return { purchaseId: purchase.id, reference: purchase.reference };
    });

    return result;
  }
}
