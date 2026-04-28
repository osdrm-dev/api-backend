import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  MaintenanceInterventionType,
  MaintenanceStatus,
  MaintenanceUrgencyLevel,
} from '@prisma/client';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceRepository } from 'src/repository/maintenance/maintenance.repository';

const makeRequest = (overrides: Record<string, unknown> = {}) => ({
  id: 'req-1',
  reference: 'ENT-2026-0001',
  title: 'Test',
  description: 'Test description',
  status: MaintenanceStatus.PENDING,
  requestorId: 42,
  deletedAt: null,
  interventionType: MaintenanceInterventionType.REPARATION,
  urgencyLevel: MaintenanceUrgencyLevel.NORMALE,
  ...overrides,
});

describe('MaintenanceService - Reference Generation', () => {
  let service: MaintenanceService;

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    generateReference: jest.fn(),
    findAllAdmin: jest.fn(),
    findAllForRequestor: jest.fn(),
    findStats: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: MaintenanceRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
  });

  describe('createRequest - reference generation', () => {
    const baseDto = {
      interventionType: MaintenanceInterventionType.REPARATION,
      title: 'Test',
      description: 'Test description',
    };

    it('should create first request with ENT-YYYY-0001', async () => {
      const year = new Date().getFullYear();
      const ref = `ENT-${year}-0001`;

      mockRepository.generateReference.mockResolvedValue(ref);
      mockRepository.create.mockResolvedValue(makeRequest({ reference: ref }));

      const result = await service.createRequest(
        baseDto as MaintenanceInterventionType as any,
        42,
      );

      expect(mockRepository.generateReference).toHaveBeenCalledWith(year);
      expect(result.reference).toBe(ref);
    });

    it('should create second request with ENT-YYYY-0002', async () => {
      const year = new Date().getFullYear();
      const ref = `ENT-${year}-0002`;

      mockRepository.generateReference.mockResolvedValue(ref);
      mockRepository.create.mockResolvedValue(makeRequest({ reference: ref }));

      const result = await service.createRequest(baseDto as any, 42);

      expect(result.reference).toBe(ref);
    });

    it('should retry on P2002 collision and succeed on second attempt', async () => {
      const year = new Date().getFullYear();
      const ref = `ENT-${year}-0001`;

      mockRepository.generateReference
        .mockResolvedValueOnce(ref)
        .mockResolvedValueOnce(ref);

      const collision = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });

      mockRepository.create
        .mockRejectedValueOnce(collision)
        .mockResolvedValueOnce(makeRequest({ reference: ref }));

      const result = await service.createRequest(baseDto as any, 42);

      expect(mockRepository.create).toHaveBeenCalledTimes(2);
      expect(result.reference).toBe(ref);
    });
  });

  describe('getRequestForRequestor', () => {
    it('should return request when owner matches', async () => {
      mockRepository.findById.mockResolvedValue(makeRequest());

      const result = await service.getRequestForRequestor('req-1', 42);

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when requestorId does not match (not 403)', async () => {
      mockRepository.findById.mockResolvedValue(makeRequest());

      await expect(
        service.getRequestForRequestor('req-1', 999),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when request is soft-deleted', async () => {
      mockRepository.findById.mockResolvedValue(
        makeRequest({ deletedAt: new Date() }),
      );

      await expect(service.getRequestForRequestor('req-1', 42)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateRequestor', () => {
    it('should throw ForbiddenException when status is not PENDING', async () => {
      mockRepository.findById.mockResolvedValue(
        makeRequest({ status: MaintenanceStatus.IN_PROGRESS }),
      );

      await expect(
        service.updateRequestor('req-1', { title: 'New title' } as any, 42),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update when status is PENDING and owner matches', async () => {
      const updated = makeRequest({ title: 'New title' });
      mockRepository.findById.mockResolvedValue(makeRequest());
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateRequestor(
        'req-1',
        { title: 'New title' } as any,
        42,
      );

      expect(result.title).toBe('New title');
    });
  });

  describe('softDeleteRequest', () => {
    it('should soft-delete when status is PENDING and owner matches', async () => {
      mockRepository.findById.mockResolvedValue(makeRequest());
      mockRepository.softDelete.mockResolvedValue(
        makeRequest({ deletedAt: new Date() }),
      );

      await service.softDeleteRequest('req-1', 42);

      expect(mockRepository.softDelete).toHaveBeenCalledWith('req-1');
    });

    it('should throw ForbiddenException when status is not PENDING', async () => {
      mockRepository.findById.mockResolvedValue(
        makeRequest({ status: MaintenanceStatus.VALIDATED }),
      );

      await expect(service.softDeleteRequest('req-1', 42)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
