import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LgDeplacementStatus } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { UpdateDeplacementStatusDto } from '../dto/update-deplacement-status.dto';

const TRANSITIONS: Record<LgDeplacementStatus, LgDeplacementStatus[]> = {
  EN_ATTENTE: [
    LgDeplacementStatus.VEHICULE_ATTRIBUE,
    LgDeplacementStatus.EN_ATTENTE_LOCATION,
    LgDeplacementStatus.REFUSEE,
    LgDeplacementStatus.ANNULEE,
  ],
  EN_ATTENTE_LOCATION: [
    LgDeplacementStatus.VEHICULE_ATTRIBUE,
    LgDeplacementStatus.REFUSEE,
    LgDeplacementStatus.ANNULEE,
  ],
  VEHICULE_ATTRIBUE: [
    LgDeplacementStatus.CONFIRMEE,
    LgDeplacementStatus.EN_ATTENTE,
    LgDeplacementStatus.ANNULEE,
  ],
  CONFIRMEE: [LgDeplacementStatus.EN_COURS, LgDeplacementStatus.ANNULEE],
  EN_COURS: [LgDeplacementStatus.LIQUIDEE],
  LIQUIDEE: [],
  // Statuts pilotés par le circuit de validation de liquidation (transitions
  // automatiques via LiquidationValidationService), pas par l'endpoint manuel.
  LIQUIDATION_VALIDEE: [],
  LIQUIDATION_REJETEE: [],
  REFUSEE: [],
  ANNULEE: [],
};

const STATUS_NOTIFICATION_EVENTS: Partial<Record<LgDeplacementStatus, string>> =
  {
    REFUSEE: OSDRM_PROCESS_EVENT.DEPLACEMENT_STATUS_CHANGED,
    ANNULEE: OSDRM_PROCESS_EVENT.DEPLACEMENT_STATUS_CHANGED,
    VEHICULE_ATTRIBUE: OSDRM_PROCESS_EVENT.DEPLACEMENT_STATUS_CHANGED,
    EN_ATTENTE_LOCATION: OSDRM_PROCESS_EVENT.DEPLACEMENT_STATUS_CHANGED,
  };

@Injectable()
export class DeplacementStatusService {
  constructor(
    private readonly repository: DeplacementRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async updateStatus(
    id: string,
    dto: UpdateDeplacementStatusDto,
    gestionnaireId: number,
  ) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Déplacement ${id} introuvable.`);

    const allowed = TRANSITIONS[dep.status];
    if (!allowed.includes(dto.status)) {
      throw new UnprocessableEntityException(
        `Transition invalide : ${dep.status} → ${dto.status}.`,
      );
    }

    if (dto.status === LgDeplacementStatus.REFUSEE && !dto.motifRefus) {
      throw new UnprocessableEntityException(
        'Un motif de refus est requis pour rejeter une demande.',
      );
    }

    const updated = await this.repository.updateStatus(id, dto.status, {
      ...(dto.motifRefus ? { motifRefus: dto.motifRefus } : {}),
      gestionnaire: { connect: { id: gestionnaireId } },
    });

    const event = STATUS_NOTIFICATION_EVENTS[dto.status];
    if (event && dep.requestor?.email) {
      try {
        await this.notificationService.createNotification(
          event,
          [dep.requestor.email],
          id,
          {
            reference: dep.reference,
            newStatus: dto.status,
            motifRefus: dto.motifRefus ?? null,
          },
          false,
        );
      } catch {
        // Notification failure must not roll back status change
      }
    }

    return updated;
  }
}
