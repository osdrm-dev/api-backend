import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EquipmentAttributionStatus,
  EquipmentStatus,
  MaintenanceInterventionType,
} from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { MaintenanceService } from 'src/maintenance/services/maintenance.service';
import { FilterMaintenanceDto } from 'src/maintenance/dto/filter-maintenance.dto';
import { CreateEquipmentRepairDto } from '../dto/create-equipment-repair.dto';

/** Réparations de matériel : stockées comme demandes Entretien liées à un `Equipment`. */
@Injectable()
export class EquipmentRepairService {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    user: { id: number; role: string },
    dto: CreateEquipmentRepairDto,
  ) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: dto.equipmentId },
      include: {
        attributions: { where: { status: EquipmentAttributionStatus.ACTIVE } },
      },
    });
    if (!equipment || equipment.archivedAt !== null) {
      throw new NotFoundException('Matériel introuvable.');
    }
    const isHolder = equipment.attributions.some(
      (a) => a.beneficiaryId === user.id,
    );
    if (user.role !== 'ADMIN' && !isHolder) {
      throw new ForbiddenException(
        'Vous ne pouvez déclarer une panne que sur un matériel qui vous est attribué.',
      );
    }

    const label = equipment.inventoryReference ?? equipment.serialNumber;
    const request = await this.maintenanceService.createRequest(
      {
        interventionType: MaintenanceInterventionType.REPARATION,
        urgencyLevel: dto.urgencyLevel,
        title:
          dto.title ??
          `Panne — ${equipment.designation}${label ? ` (${label})` : ''}`,
        description: dto.description,
        location: equipment.location ?? undefined,
        ...(dto.fileIds?.length && { data: { attachmentIds: dto.fileIds } }),
      },
      user.id,
      equipment.id,
    );

    await this.prisma.equipment.update({
      where: { id: equipment.id },
      data: { status: EquipmentStatus.EN_PANNE },
    });

    return request;
  }

  findMine(userId: number, query: FilterMaintenanceDto) {
    return this.maintenanceService.getAllForRequestor(
      userId,
      query,
      'EQUIPMENT_ONLY',
    );
  }

  findAll(query: FilterMaintenanceDto) {
    return this.maintenanceService.getAllAdmin(query, 'EQUIPMENT_ONLY');
  }

  /** Matériels actuellement attribués à l'utilisateur (choix dans le formulaire de panne). */
  findMyEquipments(userId: number) {
    return this.prisma.equipment.findMany({
      where: {
        archivedAt: null,
        attributions: {
          some: {
            beneficiaryId: userId,
            status: EquipmentAttributionStatus.ACTIVE,
          },
        },
      },
      orderBy: { designation: 'asc' },
      include: { category: { select: { id: true, name: true } } },
    });
  }
}
