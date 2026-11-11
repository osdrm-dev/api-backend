import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MissionService } from './mission.service';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { LgMissionStatus, LgMissionType } from '@prisma/client';
import * as deadlineUtil from '../utils/thursday-deadline.util';

const mockRepository = {
  generateNextReference: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  findManyByRequestor: jest.fn(),
  updateStatus: jest.fn(),
  countByStatus: jest.fn(),
};

const mockPrisma = {
  user: { findMany: jest.fn() },
  lgMission: { findMany: jest.fn() },
};

const mockNotification = {
  createNotification: jest.fn(),
};

const BASE_MISSION = {
  id: 'mission-1',
  reference: 'TRJ-2026-0001',
  purpose: 'Mission terrain',
  destination: 'Fianarantsoa',
  departureDate: new Date('2026-05-11T00:00:00.000Z'),
  returnDate: new Date('2026-05-14T00:00:00.000Z'),
  missionType: LgMissionType.NATIONAL,
  passengerCount: 1,
  passengers: [],
  status: LgMissionStatus.PENDING,
  requestorId: 10,
  requestor: { id: 10, email: 'user@example.com', name: 'Test User' },
  deletedAt: null,
  settlement: null,
};

describe('MissionService', () => {
  let service: MissionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissionService,
        { provide: MissionRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<MissionService>(MissionService);
  });

  describe('create', () => {
    const dto = {
      purpose: 'Mission terrain',
      destination: 'Fianarantsoa',
      departureDate: '2026-05-11',
      returnDate: '2026-05-14',
      missionType: LgMissionType.NATIONAL,
    };

    it('creates a mission and fires MISSION_CREATED notification', async () => {
      jest.spyOn(deadlineUtil, 'isAfterDeadline').mockReturnValue(false);
      mockRepository.generateNextReference.mockResolvedValue('TRJ-2026-0001');
      mockRepository.create.mockResolvedValue(BASE_MISSION);
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'gp@test.com' }]);
      mockNotification.createNotification.mockResolvedValue({});

      const result = await service.create(dto, 10, false);
      expect(result.reference).toBe('TRJ-2026-0001');
      expect(mockNotification.createNotification).toHaveBeenCalledWith(
        'MISSION_CREATED',
        ['gp@test.com'],
        'mission-1',
        expect.any(Object),
        false,
      );
    });

    it('throws 422 when returnDate < departureDate', async () => {
      await expect(
        service.create({ ...dto, returnDate: '2026-05-10' }, 10, false),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 when deadline is exceeded', async () => {
      jest.spyOn(deadlineUtil, 'isAfterDeadline').mockReturnValue(true);
      await expect(service.create(dto, 10, false)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('bypasses deadline check when bypassDeadline=true', async () => {
      jest.spyOn(deadlineUtil, 'isAfterDeadline').mockReturnValue(true);
      mockRepository.generateNextReference.mockResolvedValue('TRJ-2026-0001');
      mockRepository.create.mockResolvedValue(BASE_MISSION);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.create(dto, 10, true);
      expect(result).toBeDefined();
    });
  });

  describe('findById', () => {
    it('returns mission to its requestor', async () => {
      mockRepository.findById.mockResolvedValue(BASE_MISSION);
      const result = await service.findById('mission-1', {
        id: 10,
        role: 'DEMANDEUR',
      });
      expect(result).toEqual(BASE_MISSION);
    });

    it('throws 404 when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(
        service.findById('mission-999', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws 403 when DEMANDEUR accesses another user's request", async () => {
      mockRepository.findById.mockResolvedValue(BASE_MISSION);
      await expect(
        service.findById('mission-1', { id: 99, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows GESTIONNAIRE_PARC to access any request', async () => {
      mockRepository.findById.mockResolvedValue(BASE_MISSION);
      const result = await service.findById('mission-1', {
        id: 99,
        role: 'GESTIONNAIRE_PARC',
      });
      expect(result).toEqual(BASE_MISSION);
    });
  });

  describe('cancel', () => {
    it('allows DEMANDEUR to cancel own PENDING request', async () => {
      mockRepository.findById.mockResolvedValue(BASE_MISSION);
      mockRepository.updateStatus.mockResolvedValue({
        ...BASE_MISSION,
        status: 'CANCELLED',
      });
      mockNotification.createNotification.mockResolvedValue({});

      const result = await service.cancel('mission-1', {
        id: 10,
        role: 'DEMANDEUR',
      });
      expect(result.status).toBe('CANCELLED');
    });

    it("throws 403 when DEMANDEUR tries to cancel another user's request", async () => {
      mockRepository.findById.mockResolvedValue(BASE_MISSION);
      await expect(
        service.cancel('mission-1', { id: 99, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 422 when trying to cancel a terminal SETTLED request', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_MISSION,
        status: 'SETTLED',
      });
      await expect(
        service.cancel('mission-1', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 403 when DEMANDEUR tries to cancel a CONFIRMED request', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_MISSION,
        status: 'CONFIRMED',
      });
      await expect(
        service.cancel('mission-1', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to cancel a CONFIRMED request', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_MISSION,
        status: 'CONFIRMED',
      });
      mockRepository.updateStatus.mockResolvedValue({
        ...BASE_MISSION,
        status: 'CANCELLED',
      });
      mockNotification.createNotification.mockResolvedValue({});

      const result = await service.cancel('mission-1', {
        id: 1,
        role: 'ADMIN',
      });
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('findLinkable', () => {
    it('findLinkable filters CONFIRMED/IN_PROGRESS, deletedAt null, search', async () => {
      mockPrisma.lgMission.findMany.mockResolvedValue([]);
      await service.findLinkable('tana');
      const arg = mockPrisma.lgMission.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        deletedAt: null,
        OR: [
          { reference: { contains: 'tana', mode: 'insensitive' } },
          { purpose: { contains: 'tana', mode: 'insensitive' } },
          { destination: { contains: 'tana', mode: 'insensitive' } },
        ],
      });
      expect(arg.orderBy).toEqual({ departureDate: 'desc' });
      expect(arg.take).toBe(50);
    });
  });
});

describe('MissionRepository.generateNextReference', () => {
  it('uses the TRJ- prefix', async () => {
    const prisma = { lgMission: { count: jest.fn().mockResolvedValue(4) } };
    const repo = new MissionRepository(prisma as unknown as PrismaService);
    expect(await repo.generateNextReference(2026)).toMatch(/^TRJ-2026-\d{4}$/);
    expect(prisma.lgMission.count).toHaveBeenCalledWith({
      where: { reference: { startsWith: 'TRJ-2026-' } },
    });
  });
});
