import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { PrismaService } from 'prisma/prisma.service';
import {
  OperationType,
  PurchaseStatus,
  PurchaseStep,
  Role,
} from '@prisma/client';
import { MaintenanceRepository } from 'src/repository/maintenance/maintenance.repository';
import { BudgetTableService } from 'src/budget/services/budget-table.service';
import { TriggerDaDto } from '../dto/trigger-da.dto';

@Injectable()
export class TriggerDaService {
  constructor(
    private readonly repository: MaintenanceRepository,
    private readonly prisma: PrismaService,
    private readonly budgetTableService: BudgetTableService,
  ) {}

  async triggerDA(requestId: string, adminUserId: number, dto: TriggerDaDto) {
    const request = await this.repository.findById(requestId);

    if (!request || request.deletedAt !== null) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Maintenance request not found',
      );
    }

    if (request.linkedPurchaseId) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.MAINTENANCE_DA_ALREADY_LINKED,
        'A purchase request is already linked to this demand',
      );
    }

    if (!request.requestorId) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.MAINTENANCE_REQUESTOR_DELETED,
        'Cannot create a purchase request: the requestor was deleted',
      );
    }

    // Validate acheteur
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

    // Resolve project from active budget table
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
          title: dto.title ?? request.title,
          description: dto.description ?? request.description,
          justification: `Demande de maintenance ${request.reference}`,
          project: project.projectName,
          projectCode: project.projectCode,
          grantCode: project.grantCode,
          activityCode: project.activityCode,
          costCenter: project.costCenter,
          region: project.region,
          site: project.site,
          status: PurchaseStatus.DRAFT,
          currentStep: PurchaseStep.DA,
          creatorId: request.requestorId,
          acheteurId: dto.acheteurId,
          data: { maintenanceRequestId: requestId },
        },
      });

      await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: { linkedPurchaseId: purchase.id },
      });

      return { purchaseId: purchase.id, reference: purchase.reference };
    });

    return result;
  }
}
