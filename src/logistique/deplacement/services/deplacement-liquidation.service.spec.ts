import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DeplacementLiquidationService } from './deplacement-liquidation.service';
import { LiquidationValidationService } from './deplacement-liquidation-validation.service';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import {
  LgDeplacementStatus,
  LgLiquidationValidationStatus,
  LgTypeMission,
} from '@prisma/client';

const mockRepository = {
  findById: jest.fn(),
};

const mockPrisma = {
  user: { findMany: jest.fn() },
  $transaction: jest.fn(),
  lgDeplacementLiquidation: { create: jest.fn(), update: jest.fn() },
  lgDeplacement: { update: jest.fn() },
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
  reference: 'DEP-2026-0001',
  status: LgDeplacementStatus.CONFIRMEE,
  requestorId: 10,
  requestor: { id: 10, email: 'user@test.com', name: 'Test' },
  liquidation: null,
  typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
};

describe('DeplacementLiquidationService', () => {
  let service: DeplacementLiquidationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeplacementLiquidationService,
        { provide: DeplacementRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
        {
          provide: LiquidationValidationService,
          useValue: mockValidationService,
        },
      ],
    }).compile();

    service = module.get<DeplacementLiquidationService>(
      DeplacementLiquidationService,
    );
  });

  it('throws 404 when deplacement not found', async () => {
    mockRepository.findById.mockResolvedValue(null);
    await expect(
      service.submit(
        'dep-999',
        { fraisTransport: 0, fraisHebergement: 0, fraisRestauration: 0 },
        1,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 422 when status is EN_ATTENTE', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_DEP,
      status: LgDeplacementStatus.EN_ATTENTE,
    });
    await expect(
      service.submit(
        'dep-1',
        { fraisTransport: 0, fraisHebergement: 0, fraisRestauration: 0 },
        1,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws 409 when liquidation already exists', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_DEP,
      liquidation: { id: 'liq-1' },
    });
    await expect(
      service.submit(
        'dep-1',
        { fraisTransport: 0, fraisHebergement: 0, fraisRestauration: 0 },
        1,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('computes totalLiquidation and creates validation rows', async () => {
    mockRepository.findById.mockResolvedValue(BASE_DEP);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const expectedLiquidation = { id: 'liq-new', totalLiquidation: 70000 };
    const tx = {
      lgDeplacementLiquidation: {
        create: jest.fn().mockResolvedValue(expectedLiquidation),
      },
      lgDeplacement: { update: jest.fn().mockResolvedValue({}) },
    };
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));

    const result = await service.submit(
      'dep-1',
      {
        fraisTransport: 15000,
        fraisHebergement: 30000,
        fraisRestauration: 20000,
        autresFrais: 5000,
      },
      1,
    );
    expect(result).toEqual(expectedLiquidation);
    expect(mockValidationService.createValidationRows).toHaveBeenCalledWith(
      tx,
      'liq-new',
    );
    expect(tx.lgDeplacement.update).toHaveBeenCalledWith({
      where: { id: 'dep-1' },
      data: { status: LgDeplacementStatus.LIQUIDEE },
    });
    expect(mockValidationService.notifyValidationRequired).toHaveBeenCalled();
  });

  it('allows liquidation when status is EN_COURS', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_DEP,
      status: LgDeplacementStatus.EN_COURS,
    });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const expectedLiquidation = { id: 'liq-new' };
    const tx = {
      lgDeplacementLiquidation: {
        create: jest.fn().mockResolvedValue(expectedLiquidation),
      },
      lgDeplacement: { update: jest.fn().mockResolvedValue({}) },
    };
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));

    const result = await service.submit(
      'dep-1',
      {
        fraisTransport: 10000,
        fraisHebergement: 10000,
        fraisRestauration: 10000,
      },
      1,
    );
    expect(result).toEqual(expectedLiquidation);
  });

  it('throws 404 when getting liquidation on deplacement without one', async () => {
    mockRepository.findById.mockResolvedValue(BASE_DEP); // liquidation: null
    await expect(service.getLiquidation('dep-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('resubmit', () => {
    const USER = { id: 10, role: 'DEMANDEUR' };
    const DTO = {
      fraisTransport: 1000,
      fraisHebergement: 2000,
      fraisRestauration: 3000,
    };

    it('throws 404 when no liquidation exists', async () => {
      mockRepository.findById.mockResolvedValue(BASE_DEP);
      await expect(service.resubmit('dep-1', DTO, USER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 403 when current user is not the requestor', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_DEP,
        status: LgDeplacementStatus.LIQUIDATION_REJETEE,
        liquidation: {
          id: 'liq-1',
          validations: [
            { role: 'OM', status: LgLiquidationValidationStatus.REJETEE },
          ],
        },
      });
      await expect(
        service.resubmit('dep-1', DTO, { id: 99, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 422 when no validation row is REJETEE', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_DEP,
        status: LgDeplacementStatus.LIQUIDEE,
        liquidation: {
          id: 'liq-1',
          validations: [
            { role: 'OM', status: LgLiquidationValidationStatus.EN_ATTENTE },
            { role: 'CFO', status: LgLiquidationValidationStatus.VALIDEE },
          ],
        },
      });
      await expect(service.resubmit('dep-1', DTO, USER)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('resets validations and sets status back to LIQUIDEE', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_DEP,
        status: LgDeplacementStatus.LIQUIDATION_REJETEE,
        liquidation: {
          id: 'liq-1',
          validations: [
            { role: 'OM', status: LgLiquidationValidationStatus.REJETEE },
          ],
        },
      });
      const updated = { id: 'liq-1', totalLiquidation: 6000 };
      const tx = {
        lgDeplacementLiquidation: {
          update: jest.fn().mockResolvedValue(updated),
        },
        lgDeplacement: { update: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));

      const result = await service.resubmit('dep-1', DTO, USER);
      expect(result).toEqual(updated);
      expect(mockValidationService.resubmitReset).toHaveBeenCalledWith(
        tx,
        'liq-1',
      );
      expect(tx.lgDeplacement.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { status: LgDeplacementStatus.LIQUIDEE },
      });
    });
  });
});
