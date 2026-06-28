import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  LgDeplacementStatus,
  LgLiquidationValidationStatus,
  LgLiquidationValidatorRole,
} from '@prisma/client';
import { LiquidationValidationService } from './deplacement-liquidation-validation.service';
import { PrismaService } from 'prisma/prisma.service';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { LiquidationValidationRepository } from 'src/repository/deplacement/liquidation-validation.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';

const mockDeplacementRepository = {
  findById: jest.fn(),
};

const mockValidationRepository = {
  findValidationsByLiquidationId: jest.fn(),
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
  reference: 'DEP-2026-0001',
  status: LgDeplacementStatus.LIQUIDEE,
  requestorId: 10,
  requestor: { email: 'demandeur@test.com' },
  liquidation: { id: 'liq-1' },
};

const rows = (overrides: Partial<Record<string, string>> = {}) => [
  {
    id: 'v-dem',
    role: LgLiquidationValidatorRole.DEMANDEUR,
    status: overrides.DEMANDEUR ?? LgLiquidationValidationStatus.EN_ATTENTE,
  },
  {
    id: 'v-om',
    role: LgLiquidationValidatorRole.OM,
    status: overrides.OM ?? LgLiquidationValidationStatus.EN_ATTENTE,
  },
  {
    id: 'v-cfo',
    role: LgLiquidationValidatorRole.CFO,
    status: overrides.CFO ?? LgLiquidationValidationStatus.EN_ATTENTE,
  },
];

describe('LiquidationValidationService', () => {
  let service: LiquidationValidationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidationValidationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DeplacementRepository, useValue: mockDeplacementRepository },
        {
          provide: LiquidationValidationRepository,
          useValue: mockValidationRepository,
        },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get(LiquidationValidationService);
    mockValidationRepository.findValidationsByLiquidationId.mockResolvedValue(
      rows(),
    );
    // default $transaction passes a tx exposing lgDeplacement.update
    mockPrisma.$transaction.mockImplementation(async (cb) =>
      cb({ lgDeplacement: { update: jest.fn().mockResolvedValue({}) } }),
    );
    mockPrisma.user.findMany.mockResolvedValue([]);
  });

  describe('resolveTargetRole', () => {
    it('maps the global role to the validator role', () => {
      expect(service.resolveTargetRole({ id: 1, role: 'OM' })).toBe(
        LgLiquidationValidatorRole.OM,
      );
      expect(service.resolveTargetRole({ id: 1, role: 'CFO' })).toBe(
        LgLiquidationValidatorRole.CFO,
      );
      expect(service.resolveTargetRole({ id: 1, role: 'DEMANDEUR' })).toBe(
        LgLiquidationValidatorRole.DEMANDEUR,
      );
    });

    it('requires an explicit role for ADMIN', () => {
      expect(() => service.resolveTargetRole({ id: 1, role: 'ADMIN' })).toThrow(
        UnprocessableEntityException,
      );
      expect(
        service.resolveTargetRole(
          { id: 1, role: 'ADMIN' },
          LgLiquidationValidatorRole.OM,
        ),
      ).toBe(LgLiquidationValidatorRole.OM);
    });

    it('rejects an unrelated global role', () => {
      expect(() =>
        service.resolveTargetRole({ id: 1, role: 'GESTIONNAIRE_PARC' }),
      ).toThrow(ForbiddenException);
    });
  });

  describe('decide - authorization', () => {
    it('throws 404 when deplacement not found', async () => {
      mockDeplacementRepository.findById.mockResolvedValue(null);
      await expect(
        service.decide(
          'dep-x',
          LgLiquidationValidatorRole.OM,
          LgLiquidationValidationStatus.VALIDEE,
          undefined,
          { id: 1, role: 'OM' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when no liquidation submitted', async () => {
      mockDeplacementRepository.findById.mockResolvedValue({
        ...DEP,
        liquidation: null,
      });
      await expect(
        service.decide(
          'dep-1',
          LgLiquidationValidatorRole.OM,
          LgLiquidationValidationStatus.VALIDEE,
          undefined,
          { id: 1, role: 'OM' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks decision on a cancelled deplacement', async () => {
      mockDeplacementRepository.findById.mockResolvedValue({
        ...DEP,
        status: LgDeplacementStatus.ANNULEE,
      });
      await expect(
        service.decide(
          'dep-1',
          LgLiquidationValidatorRole.OM,
          LgLiquidationValidationStatus.VALIDEE,
          undefined,
          { id: 1, role: 'OM' },
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('forbids DEMANDEUR line decision by a non-requestor', async () => {
      mockDeplacementRepository.findById.mockResolvedValue(DEP);
      await expect(
        service.decide(
          'dep-1',
          LgLiquidationValidatorRole.DEMANDEUR,
          LgLiquidationValidationStatus.VALIDEE,
          undefined,
          { id: 99, role: 'DEMANDEUR' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks DEMANDEUR line when requestorId is null', async () => {
      mockDeplacementRepository.findById.mockResolvedValue({
        ...DEP,
        requestorId: null,
        requestor: null,
      });
      await expect(
        service.decide(
          'dep-1',
          LgLiquidationValidatorRole.DEMANDEUR,
          LgLiquidationValidationStatus.VALIDEE,
          undefined,
          { id: 10, role: 'ADMIN' },
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('decide - state transitions', () => {
    it('throws 409 on a line already decided', async () => {
      mockDeplacementRepository.findById.mockResolvedValue(DEP);
      mockValidationRepository.findValidationsForUpdate.mockResolvedValue(
        rows({ OM: LgLiquidationValidationStatus.VALIDEE }),
      );
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({ lgDeplacement: { update: jest.fn() } }),
      );
      await expect(
        service.decide(
          'dep-1',
          LgLiquidationValidatorRole.OM,
          LgLiquidationValidationStatus.VALIDEE,
          undefined,
          { id: 1, role: 'OM' },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('does NOT change deplacement status when not all are validated', async () => {
      mockDeplacementRepository.findById.mockResolvedValue(DEP);
      mockValidationRepository.findValidationsForUpdate.mockResolvedValue(
        rows(),
      );
      const depUpdate = jest.fn().mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({ lgDeplacement: { update: depUpdate } }),
      );

      const res = await service.decide(
        'dep-1',
        LgLiquidationValidatorRole.OM,
        LgLiquidationValidationStatus.VALIDEE,
        undefined,
        { id: 1, role: 'OM' },
      );
      expect(depUpdate).not.toHaveBeenCalled();
      expect(res.deplacementStatus).toBe(LgDeplacementStatus.LIQUIDEE);
    });

    it('sets LIQUIDATION_VALIDEE when the last line is validated', async () => {
      mockDeplacementRepository.findById.mockResolvedValue(DEP);
      mockValidationRepository.findValidationsForUpdate.mockResolvedValue(
        rows({
          DEMANDEUR: LgLiquidationValidationStatus.VALIDEE,
          OM: LgLiquidationValidationStatus.VALIDEE,
        }),
      );
      const depUpdate = jest.fn().mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({ lgDeplacement: { update: depUpdate } }),
      );

      const res = await service.decide(
        'dep-1',
        LgLiquidationValidatorRole.CFO,
        LgLiquidationValidationStatus.VALIDEE,
        undefined,
        { id: 1, role: 'CFO' },
      );
      expect(depUpdate).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { status: LgDeplacementStatus.LIQUIDATION_VALIDEE },
      });
      expect(res.deplacementStatus).toBe(
        LgDeplacementStatus.LIQUIDATION_VALIDEE,
      );
    });

    it('sets LIQUIDATION_REJETEE on a rejection', async () => {
      mockDeplacementRepository.findById.mockResolvedValue(DEP);
      mockValidationRepository.findValidationsForUpdate.mockResolvedValue(
        rows(),
      );
      const depUpdate = jest.fn().mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({ lgDeplacement: { update: depUpdate } }),
      );

      const res = await service.decide(
        'dep-1',
        LgLiquidationValidatorRole.OM,
        LgLiquidationValidationStatus.REJETEE,
        'Montant incorrect',
        { id: 1, role: 'OM' },
      );
      expect(depUpdate).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { status: LgDeplacementStatus.LIQUIDATION_REJETEE },
      });
      expect(res.deplacementStatus).toBe(
        LgDeplacementStatus.LIQUIDATION_REJETEE,
      );
      expect(mockNotification.createNotification).toHaveBeenCalled();
    });
  });
});
