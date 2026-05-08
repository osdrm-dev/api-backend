import { Test, TestingModule } from '@nestjs/testing';
import { ParcAutoAlertCron } from './parc-auto-alert.cron';
import { ParcAutoRepository } from 'src/repository/parc-auto/parc-auto.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { PrismaService } from 'prisma/prisma.service';

const mockParcAutoRepository = {
  findDocumentsExpiringWithin: jest.fn(),
  createAlertLog: jest.fn(),
};

const mockNotificationService = {
  createNotification: jest.fn(),
};

const mockPrismaService = {
  user: {
    findMany: jest.fn(),
  },
};

describe('ParcAutoAlertCron', () => {
  let cron: ParcAutoAlertCron;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParcAutoAlertCron,
        { provide: ParcAutoRepository, useValue: mockParcAutoRepository },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    cron = module.get<ParcAutoAlertCron>(ParcAutoAlertCron);
  });

  it('should be defined', () => {
    expect(cron).toBeDefined();
  });

  describe('handleExpiryAlerts', () => {
    it('should not create notifications when no ADMIN users exist', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await cron.handleExpiryAlerts();

      expect(
        mockParcAutoRepository.findDocumentsExpiringWithin,
      ).not.toHaveBeenCalled();
      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should not create notifications when repository returns empty for all thresholds', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'admin@example.com' },
      ]);
      mockParcAutoRepository.findDocumentsExpiringWithin.mockResolvedValue([]);

      await cron.handleExpiryAlerts();

      expect(
        mockParcAutoRepository.findDocumentsExpiringWithin,
      ).toHaveBeenCalledTimes(4);
      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should iterate over all four thresholds [30, 15, 7, 0]', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'admin@example.com' },
      ]);
      mockParcAutoRepository.findDocumentsExpiringWithin.mockResolvedValue([]);

      await cron.handleExpiryAlerts();

      expect(
        mockParcAutoRepository.findDocumentsExpiringWithin,
      ).toHaveBeenCalledWith(30);
      expect(
        mockParcAutoRepository.findDocumentsExpiringWithin,
      ).toHaveBeenCalledWith(15);
      expect(
        mockParcAutoRepository.findDocumentsExpiringWithin,
      ).toHaveBeenCalledWith(7);
      expect(
        mockParcAutoRepository.findDocumentsExpiringWithin,
      ).toHaveBeenCalledWith(0);
    });

    it('should create a notification and alert log per expiring document', async () => {
      const adminEmail = 'admin@example.com';
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: adminEmail },
      ]);

      const mockDoc = {
        id: 'doc-1',
        vehicleId: 'vehicle-1',
        type: 'ASSURANCE',
        reference: 'POL-001',
        dateExpiration: new Date('2026-05-01'),
        vehicle: { immatriculation: '1234 TAA' },
      };

      mockParcAutoRepository.findDocumentsExpiringWithin.mockImplementation(
        (threshold: number) => (threshold === 30 ? [mockDoc] : []),
      );
      mockNotificationService.createNotification.mockResolvedValue({});
      mockParcAutoRepository.createAlertLog.mockResolvedValue(undefined);

      await cron.handleExpiryAlerts();

      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(
        1,
      );
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        'VEHICLE_DOCUMENT_EXPIRY_ALERT',
        [adminEmail],
        'doc-1',
        expect.objectContaining({ thresholdDays: 30 }),
      );
      expect(mockParcAutoRepository.createAlertLog).toHaveBeenCalledWith(
        'doc-1',
        30,
      );
    });

    it('should continue processing other documents when one fails', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'admin@example.com' },
      ]);

      const doc1 = {
        id: 'doc-1',
        vehicleId: 'v-1',
        type: 'ASSURANCE',
        reference: null,
        dateExpiration: new Date(),
        vehicle: { immatriculation: '1111 AA' },
      };
      const doc2 = {
        id: 'doc-2',
        vehicleId: 'v-2',
        type: 'VISITE_TECHNIQUE',
        reference: null,
        dateExpiration: new Date(),
        vehicle: { immatriculation: '2222 BB' },
      };

      mockParcAutoRepository.findDocumentsExpiringWithin.mockImplementation(
        (threshold: number) => (threshold === 7 ? [doc1, doc2] : []),
      );

      mockNotificationService.createNotification
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({});

      mockParcAutoRepository.createAlertLog.mockResolvedValue(undefined);

      await cron.handleExpiryAlerts();

      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(
        2,
      );
      expect(mockParcAutoRepository.createAlertLog).toHaveBeenCalledTimes(1);
      expect(mockParcAutoRepository.createAlertLog).toHaveBeenCalledWith(
        'doc-2',
        7,
      );
    });
  });
});
