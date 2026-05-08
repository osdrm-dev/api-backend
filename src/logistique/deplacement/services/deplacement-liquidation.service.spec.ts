import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DeplacementLiquidationService } from './deplacement-liquidation.service';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { LgDeplacementStatus, LgTypeMission } from '@prisma/client';

const mockRepository = {
  findById: jest.fn(),
};

const mockPrisma = {
  user: { findMany: jest.fn() },
  $transaction: jest.fn(),
  lgDeplacementLiquidation: { create: jest.fn() },
  lgDeplacement: { update: jest.fn() },
};

const mockNotification = {
  createNotification: jest.fn(),
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

  it('computes totalLiquidation correctly', async () => {
    mockRepository.findById.mockResolvedValue(BASE_DEP);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const expectedLiquidation = { id: 'liq-new', totalLiquidation: 70000 };
    mockPrisma.$transaction.mockResolvedValue([expectedLiquidation, {}]);

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
  });

  it('allows liquidation when status is EN_COURS', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_DEP,
      status: LgDeplacementStatus.EN_COURS,
    });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const expectedLiquidation = { id: 'liq-new' };
    mockPrisma.$transaction.mockResolvedValue([expectedLiquidation, {}]);

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
});
