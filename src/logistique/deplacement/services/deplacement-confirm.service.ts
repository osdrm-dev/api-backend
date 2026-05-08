import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, LgDeplacementStatus } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { ConfirmDeplacementDto } from '../dto/confirm-deplacement.dto';

@Injectable()
export class DeplacementConfirmService {
  constructor(
    private readonly repository: DeplacementRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async confirm(
    id: string,
    dto: ConfirmDeplacementDto,
    gestionnaireId: number,
  ) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Déplacement ${id} introuvable.`);

    if (dep.status !== LgDeplacementStatus.VEHICULE_ATTRIBUE) {
      throw new UnprocessableEntityException(
        `Impossible de confirmer un déplacement en statut ${dep.status}. Le véhicule doit d'abord être attribué.`,
      );
    }

    const updated = await this.repository.confirm(
      id,
      gestionnaireId,
      new Prisma.Decimal(dto.montantPerDiem),
      dto.instructionsComplementaires,
    );

    try {
      if (dep.requestor?.email) {
        const expiredAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.DEPLACEMENT_CONFIRME,
          [dep.requestor.email],
          id,
          {
            reference: dep.reference,
            destination: dep.destination,
            dateDepart: dep.dateDepart,
            dateRetour: dep.dateRetour,
            montantPerDiem: dto.montantPerDiem,
            vehicleImmatriculation: dep.vehicle?.immatriculation ?? null,
          },
          false,
          expiredAt,
        );
      }
    } catch {
      // Notification failure must not roll back confirmation
    }

    return updated;
  }
}
