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
import { CarburantRepository } from 'src/repository/carburant/carburant.repository';
import { CreateCarburantDto } from './dto/create-carburant.dto';
import { FilterCarburantDto } from './dto/filter-carburant.dto';

@Injectable()
export class CarburantService {
  constructor(
    private readonly carburantRepository: CarburantRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateCarburantDto, requestorId: number) {
    const where = dto.vehicleId
      ? { id: dto.vehicleId }
      : { immatriculation: dto.immatriculation! };

    const vehicle = await this.prisma.vehicle.findUnique({ where });

    if (!vehicle) {
      const identifier = dto.vehicleId ?? dto.immatriculation;
      throw new UnprocessableEntityException(
        `Véhicule ${identifier} introuvable.`,
      );
    }

    if (vehicle.statut !== 'ACTIF') {
      throw new UnprocessableEntityException(
        `Le véhicule ${vehicle.immatriculation} n'est pas actif.`,
      );
    }

    const year = new Date().getFullYear();
    const reference =
      await this.carburantRepository.generateNextReference(year);

    const carburant = await this.carburantRepository.create({
      reference,
      typeCarburant: dto.typeCarburant,
      volumeLitres: dto.volumeLitres,
      prixUnitaire: dto.prixUnitaire,
      montantTotal: dto.montantTotal,
      kilometrage: dto.kilometrage,
      station: dto.station,
      notes: dto.notes,
      dateApprovisionnement: new Date(dto.dateApprovisionnement),
      vehicle: { connect: { id: vehicle.id } },
      requestor: { connect: { id: requestorId } },
    });

    try {
      const admins = await this.prisma.user.findMany({
        where: { role: Role.ADMIN, isActive: true },
        select: { email: true },
      });
      const emails = admins.map((u) => u.email).filter(Boolean);
      if (emails.length) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.FUEL_SUPPLY_CREATED,
          emails,
          carburant.id,
          { reference, requestorId },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back creation
    }

    return carburant;
  }

  async findAll(query: FilterCarburantDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.carburantRepository.findMany(
      {
        status: query.status,
        typeCarburant: query.typeCarburant,
        vehicleId: query.vehicleId,
        requestorId: query.requestorId,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        search: query.search,
      },
      { skip: (page - 1) * limit, take: limit },
    );
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findMyAppros(userId: number, query: FilterCarburantDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.carburantRepository.findManyByRequestor(
      userId,
      {
        status: query.status,
        typeCarburant: query.typeCarburant,
        vehicleId: query.vehicleId,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        search: query.search,
      },
      { skip: (page - 1) * limit, take: limit },
    );
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, caller: { id: number; role: string }) {
    const carburant = await this.carburantRepository.findById(id);
    if (!carburant) {
      throw new NotFoundException(
        `Approvisionnement carburant ${id} introuvable.`,
      );
    }

    if (caller.role !== Role.ADMIN && carburant.requestorId !== caller.id) {
      throw new ForbiddenException(
        'Accès refusé à cet approvisionnement carburant.',
      );
    }

    return carburant;
  }

  async cancel(id: string, caller: { id: number; role: string }) {
    const carburant = await this.carburantRepository.findById(id);
    if (!carburant) {
      throw new NotFoundException(
        `Approvisionnement carburant ${id} introuvable.`,
      );
    }

    if (carburant.status !== 'PENDING') {
      throw new UnprocessableEntityException(
        'Seul un approvisionnement en statut PENDING peut être annulé.',
      );
    }

    if (caller.role === Role.DEMANDEUR && carburant.requestorId !== caller.id) {
      throw new ForbiddenException(
        'Vous ne pouvez annuler que vos propres approvisionnements.',
      );
    }

    const updated = await this.carburantRepository.updateStatus(
      id,
      'CANCELLED',
    );

    try {
      if (carburant.requestor?.email) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.FUEL_SUPPLY_STATUS_CHANGED,
          [carburant.requestor.email],
          id,
          { reference: carburant.reference, newStatus: 'CANCELLED' },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back
    }

    return updated;
  }

  async getStats() {
    return this.carburantRepository.aggregateStats();
  }
}
