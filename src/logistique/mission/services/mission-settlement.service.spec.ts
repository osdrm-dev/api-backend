import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MissionSettlementService } from './mission-settlement.service';
import { SettlementValidationService } from './settlement-validation.service';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import {
  LgMissionStatus,
  LgSettlementValidationStatus,
  LgMissionType,
} from '@prisma/client';

const mockRepository = {
  findById: jest.fn(),
};

const mockPrisma = {
  user: { findMany: jest.fn() },
  $transaction: jest.fn(),
  lgMissionSettlement: { create: jest.fn(), update: jest.fn() },
  lgMission: { update: jest.fn() },
};

const mockNotification = {
  createNotification: jest.fn(),
};

const mockValidationService = {
  createValidationRows: jest.fn(),
  resubmitReset: jest.fn(),
  notifyValidationRequired: jest.fn(),
};

const BASE_DEP = {
  id: 'dep-1',
  reference: 'TRJ-2026-0001',
  status: LgMissionStatus.CONFIRMED,
  requestorId: 10,
  requestor: { id: 10, email: 'user@test.com', name: 'Test' },
  settlement: null,
  missionType: LgMissionType.NATIONAL,
};

describe('MissionSettlementService', () => {
  let service: MissionSettlementService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissionSettlementService,
        { provide: MissionRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
        {
          provide: SettlementValidationService,
          useValue: mockValidationService,
        },
      ],
    }).compile();

    service = module.get<MissionSettlementService>(MissionSettlementService);
  });

  it('throws 404 when mission not found', async () => {
    mockRepository.findById.mockResolvedValue(null);
    await expect(
      service.submit(
        'dep-999',
        { transportCost: 0, accommodationCost: 0, mealCost: 0 },
        1,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 422 when status is PENDING', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_DEP,
      status: LgMissionStatus.PENDING,
    });
    await expect(
      service.submit(
        'dep-1',
        { transportCost: 0, accommodationCost: 0, mealCost: 0 },
        1,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws 409 when settlement already exists', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_DEP,
      settlement: { id: 'liq-1' },
    });
    await expect(
      service.submit(
        'dep-1',
        { transportCost: 0, accommodationCost: 0, mealCost: 0 },
        1,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('computes totalAmount and creates validation rows', async () => {
    mockRepository.findById.mockResolvedValue(BASE_DEP);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const expectedSettlement = { id: 'liq-new', totalAmount: 70000 };
    const tx = {
      lgMissionSettlement: {
        create: jest.fn().mockResolvedValue(expectedSettlement),
      },
      lgMission: { update: jest.fn().mockResolvedValue({}) },
    };
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));

    const result = await service.submit(
      'dep-1',
      {
        transportCost: 15000,
        accommodationCost: 30000,
        mealCost: 20000,
        otherCosts: 5000,
      },
      1,
    );
    expect(result).toEqual(expectedSettlement);
    expect(mockValidationService.createValidationRows).toHaveBeenCalledWith(
      tx,
      'liq-new',
    );
    expect(tx.lgMission.update).toHaveBeenCalledWith({
      where: { id: 'dep-1' },
      data: { status: LgMissionStatus.SETTLED },
    });
    expect(mockValidationService.notifyValidationRequired).toHaveBeenCalled();
  });

  it('allows settlement when status is IN_PROGRESS', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_DEP,
      status: LgMissionStatus.IN_PROGRESS,
    });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const expectedSettlement = { id: 'liq-new' };
    const tx = {
      lgMissionSettlement: {
        create: jest.fn().mockResolvedValue(expectedSettlement),
      },
      lgMission: { update: jest.fn().mockResolvedValue({}) },
    };
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));

    const result = await service.submit(
      'dep-1',
      {
        transportCost: 10000,
        accommodationCost: 10000,
        mealCost: 10000,
      },
      1,
    );
    expect(result).toEqual(expectedSettlement);
  });

  it('throws 404 when getting settlement on mission without one', async () => {
    mockRepository.findById.mockResolvedValue(BASE_DEP); // settlement: null
    await expect(service.getSettlement('dep-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('resubmit', () => {
    const USER = { id: 10, role: 'DEMANDEUR' };
    const DTO = {
      transportCost: 1000,
      accommodationCost: 2000,
      mealCost: 3000,
    };

    it('throws 404 when no settlement exists', async () => {
      mockRepository.findById.mockResolvedValue(BASE_DEP);
      await expect(service.resubmit('dep-1', DTO, USER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 403 when current user is not the requestor', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_DEP,
        status: LgMissionStatus.SETTLEMENT_REJECTED,
        settlement: {
          id: 'liq-1',
          validations: [
            { role: 'OM', status: LgSettlementValidationStatus.REJECTED },
          ],
        },
      });
      await expect(
        service.resubmit('dep-1', DTO, { id: 99, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 422 when no validation row is REJECTED', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_DEP,
        status: LgMissionStatus.SETTLED,
        settlement: {
          id: 'liq-1',
          validations: [
            { role: 'OM', status: LgSettlementValidationStatus.PENDING },
            { role: 'CFO', status: LgSettlementValidationStatus.APPROVED },
          ],
        },
      });
      await expect(service.resubmit('dep-1', DTO, USER)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('resets validations and sets status back to SETTLED', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_DEP,
        status: LgMissionStatus.SETTLEMENT_REJECTED,
        settlement: {
          id: 'liq-1',
          validations: [
            { role: 'OM', status: LgSettlementValidationStatus.REJECTED },
          ],
        },
      });
      const updated = { id: 'liq-1', totalAmount: 6000 };
      const tx = {
        lgMissionSettlement: {
          update: jest.fn().mockResolvedValue(updated),
        },
        lgMission: { update: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));

      const result = await service.resubmit('dep-1', DTO, USER);
      expect(result).toEqual(updated);
      expect(mockValidationService.resubmitReset).toHaveBeenCalledWith(
        tx,
        'liq-1',
      );
      expect(tx.lgMission.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { status: LgMissionStatus.SETTLED },
      });
    });
  });
});
