import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LgCarburantStatus, LgTypeCarburant } from '@prisma/client';
import { CarburantStatusService } from './carburant-status.service';
import { CarburantRepository } from 'src/repository/carburant/carburant.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';

const mockRepository = {
  findById: jest.fn(),
  updateStatus: jest.fn(),
};

const mockNotification = {
  createNotification: jest.fn(),
};

const BASE_CARBURANT = {
  id: 'car-1',
  reference: 'CAR-2026-0001',
  status: LgCarburantStatus.PENDING,
  vehicleId: 'vehicle-1',
  typeCarburant: LgTypeCarburant.GASOIL,
  volumeLitres: 50,
  montantTotal: 225000,
  requestorId: 10,
  requestor: {
    id: 10,
    email: 'user@example.com',
    name: 'Test User',
    role: 'DEMANDEUR',
  },
  deletedAt: null,
};

describe('CarburantStatusService', () => {
  let service: CarburantStatusService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarburantStatusService,
        { provide: CarburantRepository, useValue: mockRepository },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<CarburantStatusService>(CarburantStatusService);
  });

  describe('updateStatus', () => {
    it('transitions PENDING → PROCESSED successfully', async () => {
      mockRepository.findById.mockResolvedValue(BASE_CARBURANT);
      mockRepository.updateStatus.mockResolvedValue({
        ...BASE_CARBURANT,
        status: LgCarburantStatus.PROCESSED,
      });
      mockNotification.createNotification.mockResolvedValue({});

      const result = await service.updateStatus(
        'car-1',
        LgCarburantStatus.PROCESSED,
      );
      expect(result.status).toBe(LgCarburantStatus.PROCESSED);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        'car-1',
        LgCarburantStatus.PROCESSED,
      );
    });

    it('transitions PENDING → CANCELLED successfully', async () => {
      mockRepository.findById.mockResolvedValue(BASE_CARBURANT);
      mockRepository.updateStatus.mockResolvedValue({
        ...BASE_CARBURANT,
        status: LgCarburantStatus.CANCELLED,
      });

      const result = await service.updateStatus(
        'car-1',
        LgCarburantStatus.CANCELLED,
      );
      expect(result.status).toBe(LgCarburantStatus.CANCELLED);
    });

    it('throws 422 when status is already PROCESSED (terminal)', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_CARBURANT,
        status: LgCarburantStatus.PROCESSED,
      });

      await expect(
        service.updateStatus('car-1', LgCarburantStatus.CANCELLED),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 when status is already CANCELLED (terminal)', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_CARBURANT,
        status: LgCarburantStatus.CANCELLED,
      });

      await expect(
        service.updateStatus('car-1', LgCarburantStatus.PROCESSED),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws NotFoundException when carburant does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus('car-999', LgCarburantStatus.PROCESSED),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not throw when notification fails after status change', async () => {
      mockRepository.findById.mockResolvedValue(BASE_CARBURANT);
      mockRepository.updateStatus.mockResolvedValue({
        ...BASE_CARBURANT,
        status: LgCarburantStatus.PROCESSED,
      });
      mockNotification.createNotification.mockRejectedValue(
        new Error('Mail error'),
      );

      const result = await service.updateStatus(
        'car-1',
        LgCarburantStatus.PROCESSED,
      );
      expect(result).toBeDefined();
    });
  });
});
