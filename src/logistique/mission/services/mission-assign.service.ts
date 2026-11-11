import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { VehicleStatut } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { AssignVehicleDto } from '../dto/assign-vehicle.dto';

@Injectable()
export class MissionAssignService {
  constructor(
    private readonly repository: MissionRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async assignVehicle(id: string, dto: AssignVehicleDto, managerId: number) {
    const mission = await this.repository.findById(id);
    if (!mission) throw new NotFoundException(`Trajet ${id} introuvable.`);

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
      mission.departureDate,
      mission.returnDate,
      id,
    );
    if (conflict) {
      throw new ConflictException(
        `Le véhicule est déjà affecté à un autre trajet sur cette période (${conflict.reference}).`,
      );
    }

    const updated = await this.repository.assignVehicle(
      id,
      dto.vehicleId,
      managerId,
    );

    try {
      if (mission.requestor?.email) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.MISSION_STATUS_CHANGED,
          [mission.requestor.email],
          id,
          {
            reference: mission.reference,
            newStatus: 'VEHICLE_ASSIGNED',
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
