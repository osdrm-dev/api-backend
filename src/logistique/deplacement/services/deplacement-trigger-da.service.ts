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
import { BudgetTableService } from 'src/budget/services/budget-table.service';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { TriggerDaDeplacementDto } from '../dto/trigger-da-deplacement.dto';

@Injectable()
export class DeplacementTriggerDaService {
  constructor(
    private readonly repository: DeplacementRepository,
    private readonly prisma: PrismaService,
    private readonly budgetTableService: BudgetTableService,
  ) {}

  async triggerDA(
    id: string,
    dto: TriggerDaDeplacementDto,
    gestionnaireId: number,
  ) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Déplacement ${id} introuvable.`);

    if (dep.linkedPurchaseId) {
      throw new ConflictException('Une DA est déjà liée à ce déplacement.');
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
          title: dto.title ?? `Location véhicule - ${dep.reference}`,
          description:
            dto.description ??
            `Déplacement ${dep.reference} : ${dep.objet} vers ${dep.destination}`,
          justification: `Déplacement ${dep.reference}`,
          project: project.projectName,
          projectCode: project.projectCode,
          grantCode: project.grantCode,
          activityCode: project.activityCode,
          costCenter: project.costCenter,
          region: project.region,
          site: project.site,
          status: PurchaseStatus.DRAFT,
          currentStep: PurchaseStep.DA,
          creatorId: gestionnaireId,
          acheteurId: dto.acheteurId,
          data: { deplacementId: id },
        },
      });

      await tx.lgDeplacement.update({
        where: { id },
        data: {
          linkedPurchaseId: purchase.id,
          status: 'EN_ATTENTE_LOCATION',
        },
      });

      return { purchaseId: purchase.id, reference: purchase.reference };
    });

    return result;
  }
}
