import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MaintenanceStatus } from '@prisma/client';
import { MaintenanceStatusService } from './maintenance-status.service';
import { MaintenanceRepository } from 'src/repository/maintenance/maintenance.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { PrismaService } from 'prisma/prisma.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';

const mockRequest = {
  id: 'req-1',
  reference: 'ENT-2026-0001',
  title: 'Test maintenance',
  status: MaintenanceStatus.PENDING,
  requestorId: 42,
  deletedAt: null,
};

describe('MaintenanceStatusService', () => {
  let service: MaintenanceStatusService;

  const mockRepository = {
    findById: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockNotificationService = {
    createNotification: jest.fn(),
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceStatusService,
        { provide: MaintenanceRepository, useValue: mockRepository },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MaintenanceStatusService>(MaintenanceStatusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateStatus', () => {
    it('should update status and fire notification on status transition', async () => {
      const updatedRequest = {
        ...mockRequest,
        status: MaintenanceStatus.IN_PROGRESS,
      };
      mockRepository.findById.mockResolvedValue(mockRequest);
      mockRepository.updateStatus.mockResolvedValue(updatedRequest);
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'requestor@test.com',
      });
      mockNotificationService.createNotification.mockResolvedValue({});

      const result = await service.updateStatus('req-1', {
        status: MaintenanceStatus.IN_PROGRESS,
      });

      expect(result.status).toBe(MaintenanceStatus.IN_PROGRESS);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        'req-1',
        MaintenanceStatus.IN_PROGRESS,
        undefined,
      );
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        OSDRM_PROCESS_EVENT.MAINTENANCE_STATUS_CHANGED,
        ['requestor@test.com'],
        'req-1',
        expect.objectContaining({
          reference: 'ENT-2026-0001',
          newStatus: MaintenanceStatus.IN_PROGRESS,
        }),
        false,
        expect.any(Date),
      );
    });

    it('should return current request without notification when status is unchanged', async () => {
      mockRepository.findById.mockResolvedValue(mockRequest);

      const result = await service.updateStatus('req-1', {
        status: MaintenanceStatus.PENDING,
      });

      expect(result).toEqual(mockRequest);
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should update status without notification when requestorId is null', async () => {
      const requestWithoutRequestor = { ...mockRequest, requestorId: null };
      const updatedRequest = {
        ...requestWithoutRequestor,
        status: MaintenanceStatus.IN_PROGRESS,
      };
      mockRepository.findById.mockResolvedValue(requestWithoutRequestor);
      mockRepository.updateStatus.mockResolvedValue(updatedRequest);

      await service.updateStatus('req-1', {
        status: MaintenanceStatus.IN_PROGRESS,
      });

      expect(mockRepository.updateStatus).toHaveBeenCalled();
      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if request does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', {
          status: MaintenanceStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if request is soft-deleted', async () => {
      mockRepository.findById.mockResolvedValue({
        ...mockRequest,
        deletedAt: new Date(),
      });

      await expect(
        service.updateStatus('req-1', {
          status: MaintenanceStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
