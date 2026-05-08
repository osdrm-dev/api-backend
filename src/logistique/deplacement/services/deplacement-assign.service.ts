import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { VehicleStatut } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { AssignVehicleDto } from '../dto/assign-vehicle.dto';

@Injectable()
export class DeplacementAssignService {
  constructor(
    private readonly repository: DeplacementRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async assignVehicle(
    id: string,
    dto: AssignVehicleDto,
    gestionnaireId: number,
  ) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Déplacement ${id} introuvable.`);

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      select: { id: true, immatriculation: true, statut: true },
    });
    if (!vehicle) throw new NotFoundException('Véhicule introuvable.');
    if (vehicle.statut !== VehicleStatut.ACTIF) {
      throw new ConflictException("Le véhicule sélectionné n'est pas actif.");
    }

    const conflict = await this.repository.findVehicleConflict(
      dto.vehicleId,
      dep.dateDepart,
      dep.dateRetour,
      id,
    );
    if (conflict) {
      throw new ConflictException(
        `Le véhicule est déjà affecté à un autre déplacement sur cette période (${conflict.reference}).`,
      );
    }

    const updated = await this.repository.assignVehicle(
      id,
      dto.vehicleId,
      gestionnaireId,
    );

    try {
      if (dep.requestor?.email) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.DEPLACEMENT_STATUS_CHANGED,
          [dep.requestor.email],
          id,
          {
            reference: dep.reference,
            newStatus: 'VEHICULE_ATTRIBUE',
            vehicleImmatriculation: vehicle.immatriculation,
          },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back assignment
    }

    return updated;
  }
}
