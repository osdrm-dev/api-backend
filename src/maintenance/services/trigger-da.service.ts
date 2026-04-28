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
      throw new NotFoundException('Demande de maintenance introuvable.');
    }

    if (request.linkedPurchaseId) {
      throw new ConflictException('Une DA est déjà liée à cette demande.');
    }

    if (!request.requestorId) {
      throw new ConflictException(
        'Impossible de créer une DA : le demandeur de cette demande a été supprimé.',
      );
    }

    // Validate acheteur
    const acheteur = await this.prisma.user.findUnique({
      where: { id: dto.acheteurId },
      select: { id: true, role: true, isActive: true },
    });

    if (!acheteur || acheteur.role !== Role.ACHETEUR || !acheteur.isActive) {
      throw new NotFoundException(
        "L'acheteur spécifié est introuvable ou inactif.",
      );
    }

    // Resolve project from active budget table
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
