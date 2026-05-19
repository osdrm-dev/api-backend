import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { TripRepository } from 'src/repository/trip/trip.repository';
import { CreateTripDto } from '../dto/create-trip.dto';
import { FilterTripDto } from '../dto/filter-trip.dto';

@Injectable()
export class TripService {
  constructor(
    private readonly tripRepository: TripRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateTripDto, userId: number) {
    if (dto.arrivalDate) {
      const departure = new Date(dto.departureDate);
      const arrival = new Date(dto.arrivalDate);
      if (arrival < departure) {
        throw new UnprocessableEntityException(
          "La date d'arrivée doit être postérieure ou égale à la date de départ.",
        );
      }
    }

    const year = new Date().getFullYear();
    const reference = await this.tripRepository.generateNextReference(year);

    const distanceKm =
      dto.departureKm != null && dto.arrivalKm != null
        ? dto.arrivalKm - dto.departureKm
        : undefined;

    const trip = await this.tripRepository.create({
      reference,
      departureLocation: dto.departureLocation,
      arrivalLocation: dto.arrivalLocation,
      departureDate: new Date(dto.departureDate),
      arrivalDate: dto.arrivalDate ? new Date(dto.arrivalDate) : undefined,
      purpose: dto.purpose,
      transportMode: dto.transportMode,
      departureKm: dto.departureKm,
      arrivalKm: dto.arrivalKm,
      distanceKm,
      notes: dto.notes,
      requestor: { connect: { id: userId } },
      ...(dto.vehicleId && { vehicle: { connect: { id: dto.vehicleId } } }),
    });

    try {
      await this.notificationService.createNotification(
        OSDRM_PROCESS_EVENT.TRIP_CREATED,
        [],
        trip.id,
        { reference, requestorId: userId },
        false,
      );
    } catch {
      // Notification failure must not roll back creation
    }

    return trip;
  }

  async findAll(query: FilterTripDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.tripRepository.findMany(
      {
        status: query.status,
        transportMode: query.transportMode,
        requestorId: query.requestorId,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        search: query.search,
      },
      { skip: (page - 1) * limit, take: limit },
    );
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findMyTrips(userId: number, query: FilterTripDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.tripRepository.findManyByRequestor(
      userId,
      {
        status: query.status,
        transportMode: query.transportMode,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        search: query.search,
      },
      { skip: (page - 1) * limit, take: limit },
    );
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, caller: { id: number; role: string }) {
    const trip = await this.tripRepository.findById(id);
    if (!trip) throw new NotFoundException(`Trajet ${id} introuvable.`);

    if (caller.role !== Role.ADMIN && trip.requestorId !== caller.id) {
      throw new ForbiddenException('Accès refusé à ce dossier de trajet.');
    }

    return trip;
  }

  async cancel(id: string, caller: { id: number; role: string }) {
    const trip = await this.tripRepository.findById(id);
    if (!trip) throw new NotFoundException(`Trajet ${id} introuvable.`);

    if (trip.status !== 'PENDING') {
      throw new UnprocessableEntityException('Trip is not in PENDING status');
    }

    if (caller.role === Role.DEMANDEUR && trip.requestorId !== caller.id) {
      throw new ForbiddenException(
        'Vous ne pouvez annuler que vos propres demandes de trajet.',
      );
    }

    const updated = await this.tripRepository.updateStatus(id, 'CANCELLED');

    try {
      if (trip.requestor?.email) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.TRIP_STATUS_CHANGED,
          [trip.requestor.email],
          id,
          { reference: trip.reference, newStatus: 'CANCELLED' },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back
    }

    return updated;
  }

  async getStats() {
    return this.tripRepository.countByStatus();
  }
}
