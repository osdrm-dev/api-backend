import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeplacementTriggerDaService } from './deplacement-trigger-da.service';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { PrismaService } from 'prisma/prisma.service';
import { BudgetTableService } from 'src/budget/services/budget-table.service';
import { LgDeplacementStatus, LgTypeMission } from '@prisma/client';

const mockRepository = {
  findById: jest.fn(),
};

const mockPurchaseTx = {
  create: jest.fn(),
};
const mockDeplacementTx = {
  update: jest.fn(),
};
const mockPurchaseCount = jest.fn();

const mockPrisma = {
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
  purchase: { count: jest.fn() },
};

const mockBudgetService = {
  getActiveProjectInternal: jest.fn(),
};

const BASE_DEP = {
  id: 'dep-1',
  reference: 'DEP-2026-0001',
  status: LgDeplacementStatus.EN_ATTENTE,
  objet: 'Mission terrain',
  destination: 'Fianarantsoa',
  linkedPurchaseId: null,
  requestorId: 10,
  typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
};

const ACTIVE_ACHETEUR = { id: 5, role: 'ACHETEUR', isActive: true };
const PROJECT = {
  projectName: 'PROJ',
  projectCode: 'PROJ-001',
  grantCode: 'GR',
  activityCode: 'ACT',
  costCenter: 'CC',
  region: 'R',
  site: 'S',
};

describe('DeplacementTriggerDaService', () => {
  let service: DeplacementTriggerDaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeplacementTriggerDaService,
        { provide: DeplacementRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BudgetTableService, useValue: mockBudgetService },
      ],
    }).compile();

    service = module.get<DeplacementTriggerDaService>(
      DeplacementTriggerDaService,
    );
  });

  it('throws 404 when deplacement not found', async () => {
    mockRepository.findById.mockResolvedValue(null);
    await expect(
      service.triggerDA('dep-999', { activityCode: 'ACT', acheteurId: 5 }, 1),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 409 when DA already linked', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_DEP,
      linkedPurchaseId: 'purchase-1',
    });
    await expect(
      service.triggerDA('dep-1', { activityCode: 'ACT', acheteurId: 5 }, 1),
    ).rejects.toThrow(ConflictException);
  });

  it('throws 404 when acheteur is inactive or wrong role', async () => {
    mockRepository.findById.mockResolvedValue(BASE_DEP);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 5,
      role: 'DEMANDEUR',
      isActive: true,
    });
    await expect(
      service.triggerDA('dep-1', { activityCode: 'ACT', acheteurId: 5 }, 1),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates Purchase and updates deplacement in a transaction', async () => {
    mockRepository.findById.mockResolvedValue(BASE_DEP);
    mockPrisma.user.findUnique.mockResolvedValue(ACTIVE_ACHETEUR);
    mockBudgetService.getActiveProjectInternal.mockResolvedValue(PROJECT);

    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        purchase: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue({
            id: 'purchase-new',
            reference: 'DA-2026-0001',
          }),
        },
        lgDeplacement: {
          update: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    const result = await service.triggerDA(
      'dep-1',
      { activityCode: 'ACT', acheteurId: 5 },
      1,
    );
    expect(result.reference).toBe('DA-2026-0001');
  });
});
