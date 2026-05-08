import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Role } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { CreateDeplacementDto } from '../dto/create-deplacement.dto';
import { FilterDeplacementDto } from '../dto/filter-deplacement.dto';
import { isAfterDeadline } from '../utils/thursday-deadline.util';

@Injectable()
export class DeplacementService {
  constructor(
    private readonly repository: DeplacementRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    dto: CreateDeplacementDto,
    requestorId: number,
    bypassDeadline = false,
  ) {
    const dateDepart = new Date(dto.dateDepart);
    const dateRetour = new Date(dto.dateRetour);

    if (dateRetour < dateDepart) {
      throw new UnprocessableEntityException(
        'La date de retour doit être postérieure ou égale à la date de départ.',
      );
    }

    if (!bypassDeadline && isAfterDeadline(dateDepart)) {
      throw new UnprocessableEntityException(
        'La date limite de soumission est dépassée. Les demandes doivent être soumises avant le jeudi de la semaine précédant le départ (23h59 heure Madagascar).',
      );
    }

    const year = new Date().getFullYear();
    const reference = await this.repository.generateNextReference(year);

    const deplacement = await this.repository.create({
      reference,
      objet: dto.objet,
      destination: dto.destination,
      dateDepart,
      dateRetour,
      typeMission: dto.typeMission,
      nombrePersonnes: dto.nombrePersonnes ?? 1,
      passagers: dto.passagers ?? [],
      justification: dto.justification,
      requestor: { connect: { id: requestorId } },
    });

    try {
      const gestionnaires = await this.prisma.user.findMany({
        where: { role: Role.GESTIONNAIRE_PARC, isActive: true },
        select: { email: true },
      });
      const emails = gestionnaires.map((u) => u.email).filter(Boolean);
      if (emails.length) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.DEPLACEMENT_NOUVEAU,
          emails,
          deplacement.id,
          {
            reference,
            objet: dto.objet,
            destination: dto.destination,
            requestorId,
          },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back creation
    }

    return deplacement;
  }

  async findAll(query: FilterDeplacementDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.repository.findMany(
      {
        status: query.status,
        typeMission: query.typeMission,
        requestorId: query.requestorId,
        vehicleId: query.vehicleId,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        search: query.search,
      },
      { skip: (page - 1) * limit, take: limit },
    );
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findMyRequests(requestorId: number, query: FilterDeplacementDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.repository.findManyByRequestor(
      requestorId,
      {
        skip: (page - 1) * limit,
        take: limit,
      },
    );
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, currentUser: { id: number; role: string }) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Déplacement ${id} introuvable.`);

    if (
      currentUser.role !== Role.ADMIN &&
      currentUser.role !== Role.GESTIONNAIRE_PARC &&
      dep.requestorId !== currentUser.id
    ) {
      throw new ForbiddenException('Accès refusé à ce dossier de déplacement.');
    }

    return dep;
  }

  async cancel(id: string, currentUser: { id: number; role: string }) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Déplacement ${id} introuvable.`);

    const TERMINAL = ['REFUSEE', 'LIQUIDEE', 'ANNULEE'];
    if (TERMINAL.includes(dep.status)) {
      throw new UnprocessableEntityException(
        `Impossible d'annuler un dossier en statut ${dep.status}.`,
      );
    }

    if (dep.status === 'CONFIRMEE' || dep.status === 'EN_COURS') {
      if (currentUser.role !== Role.ADMIN) {
        throw new ForbiddenException(
          'Seul un administrateur peut annuler un déplacement confirmé ou en cours.',
        );
      }
    } else if (
      currentUser.role !== Role.ADMIN &&
      currentUser.role !== Role.GESTIONNAIRE_PARC &&
      dep.requestorId !== currentUser.id
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez annuler que vos propres demandes.',
      );
    }

    const updated = await this.repository.updateStatus(id, 'ANNULEE');

    try {
      if (dep.requestor?.email) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.DEPLACEMENT_STATUS_CHANGED,
          [dep.requestor.email],
          id,
          { reference: dep.reference, newStatus: 'ANNULEE' },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back
    }

    return updated;
  }

  async getStats() {
    return this.repository.countByStatus();
  }
}
