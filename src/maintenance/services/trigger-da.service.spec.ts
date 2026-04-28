import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  OperationType,
  PurchaseStatus,
  PurchaseStep,
  Role,
} from '@prisma/client';
import { TriggerDaService } from './trigger-da.service';
import { MaintenanceRepository } from 'src/repository/maintenance/maintenance.repository';
import { BudgetTableService } from 'src/budget/services/budget-table.service';
import { PrismaService } from 'prisma/prisma.service';

const mockRequest = {
  id: 'req-1',
  reference: 'ENT-2026-0001',
  title: 'Réparation moteur',
  description: 'Moteur HS',
  linkedPurchaseId: null,
  deletedAt: null,
  requestorId: 10,
};

const mockProject = {
  projectCode: 'PROJ-001',
  projectName: 'Projet Alpha',
  grantCode: 'G001',
  activityCode: 'ACT001',
  costCenter: 'CC001',
  region: 'Analamanga',
  site: 'Antananarivo',
  budgetThreshold: 1000000,
};

const mockPurchase = {
  id: 'purchase-1',
  reference: 'DA-2026-0001',
  status: PurchaseStatus.DRAFT,
  currentStep: PurchaseStep.DA,
};

describe('TriggerDaService', () => {
  let service: TriggerDaService;

  const mockRepository = {
    findById: jest.fn(),
  };

  const txMock = {
    purchase: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(mockPurchase),
    },
    maintenanceRequest: {
      update: jest.fn().mockResolvedValue({
        ...mockRequest,
        linkedPurchaseId: 'purchase-1',
      }),
    },
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation((fn: (tx: typeof txMock) => Promise<unknown>) =>
        fn(txMock),
      ),
  };

  const mockBudgetService = {
    getActiveProjectInternal: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    txMock.purchase.count.mockResolvedValue(0);
    txMock.purchase.create.mockResolvedValue(mockPurchase);
    txMock.maintenanceRequest.update.mockResolvedValue({
      ...mockRequest,
      linkedPurchaseId: 'purchase-1',
    });
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriggerDaService,
        { provide: MaintenanceRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BudgetTableService, useValue: mockBudgetService },
      ],
    }).compile();

    service = module.get<TriggerDaService>(TriggerDaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('triggerDA', () => {
    it('should create a DA with operationType=OPERATION and data containing maintenanceRequestId', async () => {
      mockRepository.findById.mockResolvedValue(mockRequest);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 5,
        role: Role.ACHETEUR,
        isActive: true,
      });
      mockBudgetService.getActiveProjectInternal.mockResolvedValue(mockProject);

      const result = await service.triggerDA('req-1', 99, {
        projectCode: 'PROJ-001',
        acheteurId: 5,
      });

      expect(result).toEqual({
        purchaseId: 'purchase-1',
        reference: 'DA-2026-0001',
      });

      expect(txMock.purchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            operationType: OperationType.OPERATION,
            data: expect.objectContaining({ maintenanceRequestId: 'req-1' }),
          }),
        }),
      );

      expect(txMock.maintenanceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1' },
          data: { linkedPurchaseId: 'purchase-1' },
        }),
      );
    });

    it('should throw ConflictException if linkedPurchaseId is already set', async () => {
      mockRepository.findById.mockResolvedValue({
        ...mockRequest,
        linkedPurchaseId: 'existing-purchase-id',
      });

      await expect(
        service.triggerDA('req-1', 99, {
          projectCode: 'PROJ-001',
          acheteurId: 5,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if request does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.triggerDA('nonexistent', 99, {
          projectCode: 'PROJ-001',
          acheteurId: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should rollback transaction if purchase creation fails', async () => {
      mockRepository.findById.mockResolvedValue(mockRequest);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 5,
        role: Role.ACHETEUR,
        isActive: true,
      });
      mockBudgetService.getActiveProjectInternal.mockResolvedValue(mockProject);
      mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

      await expect(
        service.triggerDA('req-1', 99, {
          projectCode: 'PROJ-001',
          acheteurId: 5,
        }),
      ).rejects.toThrow('DB error');
    });
  });
});
