import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { Role } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { TripRepository } from 'src/repository/trip/trip.repository';
import { LINKABLE_MISSION_STATUSES } from 'src/logistique/mission/constants/mission.constants';
import { CreateTripDto } from '../dto/create-trip.dto';
import { FilterTripDto } from '../dto/filter-trip.dto';

@Injectable()
export class TripService {
  constructor(
    private readonly tripRepository: TripRepository,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateTripDto, userId: number) {
    if (dto.arrivalDate) {
      const departure = new Date(dto.departureDate);
      const arrival = new Date(dto.arrivalDate);
      if (arrival < departure) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          ErrorCode.TRIP_ARRIVAL_BEFORE_DEPARTURE,
          'Arrival date must be on or after departure date',
          {
            fields: [
              {
                field: 'arrivalDate',
                code: ErrorCode.TRIP_ARRIVAL_BEFORE_DEPARTURE,
              },
            ],
          },
        );
      }
    }

    let vehicleConnect: { connect: { id: string } } | undefined;

    if (dto.vehicleId || dto.immatriculation) {
      const where = dto.vehicleId
        ? { id: dto.vehicleId }
        : { immatriculation: dto.immatriculation! };

      const vehicle = await this.prisma.vehicle.findUnique({ where });

      if (!vehicle) {
        const identifier = dto.vehicleId ?? dto.immatriculation;
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          ErrorCode.VEHICLE_NOT_FOUND,
          `Vehicle ${identifier} not found`,
        );
      }

      if (vehicle.statut !== 'ACTIF') {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          ErrorCode.VEHICLE_NOT_ACTIVE,
          `Vehicle ${vehicle.immatriculation} is not active`,
          { params: { immatriculation: vehicle.immatriculation } },
        );
      }

      vehicleConnect = { connect: { id: vehicle.id } };
    }

    const missionReference = dto.missionReference?.trim().toUpperCase();
    if (!dto.missionId && !missionReference) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.TRIP_MISSION_REQUIRED,
        'Mission is required',
        {
          fields: [
            { field: 'missionId', code: ErrorCode.TRIP_MISSION_REQUIRED },
          ],
        },
      );
    }

    const mission = await this.prisma.lgMission.findFirst({
      where: dto.missionId
        ? { id: dto.missionId, deletedAt: null }
        : {
            reference: missionReference!,
            deletedAt: null,
          },
    });

    if (!mission) {
      const identifier = dto.missionId ?? missionReference!;
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.TRIP_MISSION_NOT_FOUND,
        `Mission ${identifier} not found`,
      );
    }

    if (!LINKABLE_MISSION_STATUSES.includes(mission.status)) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.TRIP_MISSION_NOT_LINKABLE,
        `Mission ${mission.reference} must be CONFIRMED or IN_PROGRESS`,
        { params: { reference: mission.reference } },
      );
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
      mission: { connect: { id: mission.id } },
      ...(vehicleConnect && { vehicle: vehicleConnect }),
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
    if (!trip)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Trip ${id} not found`,
      );

    if (caller.role !== Role.ADMIN && trip.requestorId !== caller.id) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.TRIP_ACCESS_DENIED,
        'Access denied to this trip file',
      );
    }

    return trip;
  }

  async cancel(id: string, caller: { id: number; role: string }) {
    const trip = await this.tripRepository.findById(id);
    if (!trip)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Trip ${id} not found`,
      );

    if (trip.status !== 'PENDING') {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.TRIP_NOT_PENDING,
        'Trip is not in PENDING status',
      );
    }

    if (caller.role === Role.DEMANDEUR && trip.requestorId !== caller.id) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.TRIP_CANCEL_OWN_ONLY,
        'You can only cancel your own trips',
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
