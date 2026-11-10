import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  LgMissionStatus,
  LgSettlementValidationStatus,
  LgSettlementValidatorRole,
} from '@prisma/client';
import { SettlementValidationService } from './settlement-validation.service';
import { PrismaService } from 'prisma/prisma.service';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { SettlementValidationRepository } from 'src/repository/mission/settlement-validation.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';

const mockMissionRepository = {
  findById: jest.fn(),
};

const mockValidationRepository = {
  findValidationsBySettlementId: jest.fn(),
  findValidationsForUpdate: jest.fn(),
  updateValidationDecision: jest.fn(),
};

const mockPrisma = {
  $transaction: jest.fn(),
  user: { findMany: jest.fn() },
};

const mockNotification = {
  createNotification: jest.fn(),
};

const DEP = {
  id: 'dep-1',
  reference: 'TRJ-2026-0001',
  status: LgMissionStatus.SETTLED,
  requestorId: 10,
  requestor: { email: 'demandeur@test.com' },
  settlement: { id: 'liq-1' },
};

const rows = (overrides: Partial<Record<string, string>> = {}) => [
  {
    id: 'v-dem',
    role: LgSettlementValidatorRole.DEMANDEUR,
    status: overrides.DEMANDEUR ?? LgSettlementValidationStatus.PENDING,
  },
  {
    id: 'v-om',
    role: LgSettlementValidatorRole.OM,
    status: overrides.OM ?? LgSettlementValidationStatus.PENDING,
  },
  {
    id: 'v-cfo',
    role: LgSettlementValidatorRole.CFO,
    status: overrides.CFO ?? LgSettlementValidationStatus.PENDING,
  },
];

describe('SettlementValidationService', () => {
  let service: SettlementValidationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementValidationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MissionRepository, useValue: mockMissionRepository },
        {
          provide: SettlementValidationRepository,
          useValue: mockValidationRepository,
        },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get(SettlementValidationService);
    mockValidationRepository.findValidationsBySettlementId.mockResolvedValue(
      rows(),
    );
    // default $transaction passes a tx exposing lgMission.update
    mockPrisma.$transaction.mockImplementation(async (cb) =>
      cb({ lgMission: { update: jest.fn().mockResolvedValue({}) } }),
    );
    mockPrisma.user.findMany.mockResolvedValue([]);
  });

  describe('resolveTargetRole', () => {
    it('maps the global role to the validator role', () => {
      expect(service.resolveTargetRole({ id: 1, role: 'OM' })).toBe(
        LgSettlementValidatorRole.OM,
      );
      expect(service.resolveTargetRole({ id: 1, role: 'CFO' })).toBe(
        LgSettlementValidatorRole.CFO,
      );
      expect(service.resolveTargetRole({ id: 1, role: 'DEMANDEUR' })).toBe(
        LgSettlementValidatorRole.DEMANDEUR,
      );
    });

    it('requires an explicit role for ADMIN', () => {
      expect(() => service.resolveTargetRole({ id: 1, role: 'ADMIN' })).toThrow(
        UnprocessableEntityException,
      );
      expect(
        service.resolveTargetRole(
          { id: 1, role: 'ADMIN' },
          LgSettlementValidatorRole.OM,
        ),
      ).toBe(LgSettlementValidatorRole.OM);
    });

    it('rejects an unrelated global role', () => {
      expect(() =>
        service.resolveTargetRole({ id: 1, role: 'GESTIONNAIRE_PARC' }),
      ).toThrow(ForbiddenException);
    });
  });

  describe('decide - authorization', () => {
    it('throws 404 when mission not found', async () => {
      mockMissionRepository.findById.mockResolvedValue(null);
      await expect(
        service.decide(
          'dep-x',
          LgSettlementValidatorRole.OM,
          LgSettlementValidationStatus.APPROVED,
          undefined,
          { id: 1, role: 'OM' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when no settlement submitted', async () => {
      mockMissionRepository.findById.mockResolvedValue({
        ...DEP,
        settlement: null,
      });
      await expect(
        service.decide(
          'dep-1',
          LgSettlementValidatorRole.OM,
          LgSettlementValidationStatus.APPROVED,
          undefined,
          { id: 1, role: 'OM' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks decision on a cancelled mission', async () => {
      mockMissionRepository.findById.mockResolvedValue({
        ...DEP,
        status: LgMissionStatus.CANCELLED,
      });
      await expect(
        service.decide(
          'dep-1',
          LgSettlementValidatorRole.OM,
          LgSettlementValidationStatus.APPROVED,
          undefined,
          { id: 1, role: 'OM' },
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('forbids DEMANDEUR line decision by a non-requestor', async () => {
      mockMissionRepository.findById.mockResolvedValue(DEP);
      await expect(
        service.decide(
          'dep-1',
          LgSettlementValidatorRole.DEMANDEUR,
          LgSettlementValidationStatus.APPROVED,
          undefined,
          { id: 99, role: 'DEMANDEUR' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks DEMANDEUR line when requestorId is null', async () => {
      mockMissionRepository.findById.mockResolvedValue({
        ...DEP,
        requestorId: null,
        requestor: null,
      });
      await expect(
        service.decide(
          'dep-1',
          LgSettlementValidatorRole.DEMANDEUR,
          LgSettlementValidationStatus.APPROVED,
          undefined,
          { id: 10, role: 'ADMIN' },
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('decide - state transitions', () => {
    it('throws 409 on a line already decided', async () => {
      mockMissionRepository.findById.mockResolvedValue(DEP);
      mockValidationRepository.findValidationsForUpdate.mockResolvedValue(
        rows({ OM: LgSettlementValidationStatus.APPROVED }),
      );
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({ lgMission: { update: jest.fn() } }),
      );
      await expect(
        service.decide(
          'dep-1',
          LgSettlementValidatorRole.OM,
          LgSettlementValidationStatus.APPROVED,
          undefined,
          { id: 1, role: 'OM' },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('does NOT change mission status when not all are validated', async () => {
      mockMissionRepository.findById.mockResolvedValue(DEP);
      mockValidationRepository.findValidationsForUpdate.mockResolvedValue(
        rows(),
      );
      const depUpdate = jest.fn().mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({ lgMission: { update: depUpdate } }),
      );

      const res = await service.decide(
        'dep-1',
        LgSettlementValidatorRole.OM,
        LgSettlementValidationStatus.APPROVED,
        undefined,
        { id: 1, role: 'OM' },
      );
      expect(depUpdate).not.toHaveBeenCalled();
      expect(res.missionStatus).toBe(LgMissionStatus.SETTLED);
    });

    it('sets SETTLEMENT_APPROVED when the last line is validated', async () => {
      mockMissionRepository.findById.mockResolvedValue(DEP);
      mockValidationRepository.findValidationsForUpdate.mockResolvedValue(
        rows({
          DEMANDEUR: LgSettlementValidationStatus.APPROVED,
          OM: LgSettlementValidationStatus.APPROVED,
        }),
      );
      const depUpdate = jest.fn().mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({ lgMission: { update: depUpdate } }),
      );

      const res = await service.decide(
        'dep-1',
        LgSettlementValidatorRole.CFO,
        LgSettlementValidationStatus.APPROVED,
        undefined,
        { id: 1, role: 'CFO' },
      );
      expect(depUpdate).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { status: LgMissionStatus.SETTLEMENT_APPROVED },
      });
      expect(res.missionStatus).toBe(LgMissionStatus.SETTLEMENT_APPROVED);
    });

    it('sets SETTLEMENT_REJECTED on a rejection', async () => {
      mockMissionRepository.findById.mockResolvedValue(DEP);
      mockValidationRepository.findValidationsForUpdate.mockResolvedValue(
        rows(),
      );
      const depUpdate = jest.fn().mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({ lgMission: { update: depUpdate } }),
      );

      const res = await service.decide(
        'dep-1',
        LgSettlementValidatorRole.OM,
        LgSettlementValidationStatus.REJECTED,
        'Montant incorrect',
        { id: 1, role: 'OM' },
      );
      expect(depUpdate).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { status: LgMissionStatus.SETTLEMENT_REJECTED },
      });
      expect(res.missionStatus).toBe(LgMissionStatus.SETTLEMENT_REJECTED);
      expect(mockNotification.createNotification).toHaveBeenCalled();
    });
  });
});
