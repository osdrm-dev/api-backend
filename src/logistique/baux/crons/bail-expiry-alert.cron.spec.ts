import { Test, TestingModule } from '@nestjs/testing';
import { BailExpiryAlertCron } from './bail-expiry-alert.cron';
import { BauxRepository } from 'src/repository/baux/baux.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { PrismaService } from 'prisma/prisma.service';

const mockBauxRepository = {
  findExpiringContracts: jest.fn(),
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

describe('BailExpiryAlertCron', () => {
  let cron: BailExpiryAlertCron;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BailExpiryAlertCron,
        { provide: BauxRepository, useValue: mockBauxRepository },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    cron = module.get<BailExpiryAlertCron>(BailExpiryAlertCron);
  });

  it('should be defined', () => {
    expect(cron).toBeDefined();
  });

  describe('handleExpiryAlerts', () => {
    it('should not process when no ADMIN users exist', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await cron.handleExpiryAlerts();

      expect(mockBauxRepository.findExpiringContracts).not.toHaveBeenCalled();
      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should iterate over all four thresholds [90, 30, 15, 7]', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'admin@test.com' },
      ]);
      mockBauxRepository.findExpiringContracts.mockResolvedValue([]);

      await cron.handleExpiryAlerts();

      expect(mockBauxRepository.findExpiringContracts).toHaveBeenCalledTimes(4);
      expect(mockBauxRepository.findExpiringContracts).toHaveBeenCalledWith(
        90,
        expect.any(Number),
      );
      expect(mockBauxRepository.findExpiringContracts).toHaveBeenCalledWith(
        30,
        expect.any(Number),
      );
      expect(mockBauxRepository.findExpiringContracts).toHaveBeenCalledWith(
        15,
        expect.any(Number),
      );
      expect(mockBauxRepository.findExpiringContracts).toHaveBeenCalledWith(
        7,
        expect.any(Number),
      );
    });

    it('should not send notifications when no contracts are expiring', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'admin@test.com' },
      ]);
      mockBauxRepository.findExpiringContracts.mockResolvedValue([]);

      await cron.handleExpiryAlerts();

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
      expect(mockBauxRepository.createAlertLog).not.toHaveBeenCalled();
    });

    it('should create notification and alert log per expiring contract', async () => {
      const adminEmail = 'admin@test.com';
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: adminEmail },
      ]);

      const mockContract = {
        id: 'contract-1',
        reference: 'BAX-2026-0001',
        bailleur: 'SCI Immo',
        objetBail: 'Bureau plateau',
        dateFin: new Date('2026-07-31'),
      };

      mockBauxRepository.findExpiringContracts.mockImplementation(
        (threshold: number) => (threshold === 90 ? [mockContract] : []),
      );
      mockNotificationService.createNotification.mockResolvedValue({});
      mockBauxRepository.createAlertLog.mockResolvedValue(undefined);

      await cron.handleExpiryAlerts();

      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(
        1,
      );
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        'BAIL_EXPIRY_ALERT',
        [adminEmail],
        'contract-1',
        expect.objectContaining({
          thresholdDays: 90,
          reference: 'BAX-2026-0001',
        }),
      );
      expect(mockBauxRepository.createAlertLog).toHaveBeenCalledWith(
        'contract-1',
        90,
        expect.any(Number),
      );
    });

    it('should continue processing other contracts when one fails', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'admin@test.com' },
      ]);

      const contract1 = {
        id: 'c-1',
        reference: 'BAX-2026-0001',
        bailleur: 'A',
        objetBail: 'X',
        dateFin: new Date(),
      };
      const contract2 = {
        id: 'c-2',
        reference: 'BAX-2026-0002',
        bailleur: 'B',
        objetBail: 'Y',
        dateFin: new Date(),
      };

      mockBauxRepository.findExpiringContracts.mockImplementation(
        (threshold: number) => (threshold === 30 ? [contract1, contract2] : []),
      );

      mockNotificationService.createNotification
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({});
      mockBauxRepository.createAlertLog.mockResolvedValue(undefined);

      await cron.handleExpiryAlerts();

      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(
        2,
      );
      expect(mockBauxRepository.createAlertLog).toHaveBeenCalledTimes(1);
      expect(mockBauxRepository.createAlertLog).toHaveBeenCalledWith(
        'c-2',
        30,
        expect.any(Number),
      );
    });
  });
});
