import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { LINKABLE_MISSION_STATUSES } from '../constants/mission.constants';
import { PrismaService } from 'prisma/prisma.service';
import { Role } from '@prisma/client';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { CreateMissionDto } from '../dto/create-mission.dto';
import { FilterMissionDto } from '../dto/filter-mission.dto';
import { isAfterDeadline } from '../utils/thursday-deadline.util';

@Injectable()
export class MissionService {
  constructor(
    private readonly repository: MissionRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    dto: CreateMissionDto,
    requestorId: number,
    bypassDeadline = false,
  ) {
    const departureDate = new Date(dto.departureDate);
    const returnDate = new Date(dto.returnDate);

    if (returnDate < departureDate) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.MISSION_RETURN_BEFORE_DEPARTURE,
        'Return date must be on or after departure date',
        {
          fields: [
            {
              field: 'returnDate',
              code: ErrorCode.MISSION_RETURN_BEFORE_DEPARTURE,
            },
          ],
        },
      );
    }

    if (!bypassDeadline && isAfterDeadline(departureDate)) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.MISSION_DEADLINE_PASSED,
        'Submission deadline passed',
      );
    }

    const year = new Date().getFullYear();
    const reference = await this.repository.generateNextReference(year);

    const mission = await this.repository.create({
      reference,
      purpose: dto.purpose,
      destination: dto.destination,
      departureDate,
      returnDate,
      missionType: dto.missionType,
      passengerCount: dto.passengerCount ?? 1,
      passengers: dto.passengers ?? [],
      justification: dto.justification,
      requestor: { connect: { id: requestorId } },
    });

    try {
      const managers = await this.prisma.user.findMany({
        where: { role: Role.GESTIONNAIRE_PARC, isActive: true },
        select: { email: true },
      });
      const emails = managers.map((u) => u.email).filter(Boolean);
      if (emails.length) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.MISSION_CREATED,
          emails,
          mission.id,
          {
            reference,
            purpose: dto.purpose,
            destination: dto.destination,
            requestorId,
          },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back creation
    }

    return mission;
  }

  async findAll(query: FilterMissionDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.repository.findMany(
      {
        status: query.status,
        missionType: query.missionType,
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

  async findMyRequests(requestorId: number, query: FilterMissionDto) {
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
    const mission = await this.repository.findById(id);
    if (!mission)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Mission ${id} not found`,
      );

    if (
      currentUser.role !== Role.ADMIN &&
      currentUser.role !== Role.GESTIONNAIRE_PARC &&
      mission.requestorId !== currentUser.id
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.MISSION_ACCESS_DENIED,
        'Access denied to this mission file',
      );
    }

    return mission;
  }

  async cancel(id: string, currentUser: { id: number; role: string }) {
    const mission = await this.repository.findById(id);
    if (!mission)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Mission ${id} not found`,
      );

    const TERMINAL = ['REJECTED', 'SETTLED', 'CANCELLED'];
    if (TERMINAL.includes(mission.status)) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.MISSION_CANCEL_TERMINAL,
        `Cannot cancel a mission in status ${mission.status}`,
      );
    }

    if (mission.status === 'CONFIRMED' || mission.status === 'IN_PROGRESS') {
      if (currentUser.role !== Role.ADMIN) {
        throw new AppException(
          HttpStatus.FORBIDDEN,
          ErrorCode.MISSION_CANCEL_ADMIN_ONLY,
          'Only an admin can cancel a confirmed or in-progress mission',
        );
      }
    } else if (
      currentUser.role !== Role.ADMIN &&
      currentUser.role !== Role.GESTIONNAIRE_PARC &&
      mission.requestorId !== currentUser.id
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.MISSION_CANCEL_OWN_ONLY,
        'You can only cancel your own requests',
      );
    }

    const updated = await this.repository.updateStatus(id, 'CANCELLED');

    try {
      if (mission.requestor?.email) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.MISSION_STATUS_CHANGED,
          [mission.requestor.email],
          id,
          { reference: mission.reference, newStatus: 'CANCELLED' },
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

  async findLinkable(search?: string) {
    return this.prisma.lgMission.findMany({
      where: {
        status: { in: LINKABLE_MISSION_STATUSES },
        deletedAt: null,
        ...(search && {
          OR: (['reference', 'purpose', 'destination'] as const).map((f) => ({
            [f]: { contains: search, mode: 'insensitive' as const },
          })),
        }),
      },
      select: {
        id: true,
        reference: true,
        purpose: true,
        destination: true,
        departureDate: true,
        returnDate: true,
      },
      orderBy: { departureDate: 'desc' },
      take: 50,
    });
  }
}
