import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  LgCarburantStatus,
  LgTypeCarburant,
  VehicleStatut,
} from '@prisma/client';
import { CarburantService, computeConsumption } from './carburant.service';
import { CarburantRepository } from 'src/repository/carburant/carburant.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { PrismaService } from 'prisma/prisma.service';

const mockRepository = {
  generateNextReference: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  findManyByRequestor: jest.fn(),
  updateStatus: jest.fn(),
  aggregateStats: jest.fn(),
  findForConsumption: jest.fn(),
};

const mockPrisma = {
  vehicle: { findUnique: jest.fn() },
  user: { findMany: jest.fn() },
  file: { count: jest.fn() },
};

const mockNotification = {
  createNotification: jest.fn(),
};

const BASE_VEHICLE = {
  id: 'vehicle-1',
  immatriculation: 'IM-001-T',
  marque: 'Toyota',
  modele: 'Hilux',
  statut: VehicleStatut.ACTIF,
};

const BASE_CARBURANT = {
  id: 'car-1',
  reference: 'CAR-2026-0001',
  status: LgCarburantStatus.PENDING,
  vehicleId: 'vehicle-1',
  vehicle: {
    id: 'vehicle-1',
    immatriculation: 'IM-001-T',
    marque: 'Toyota',
    modele: 'Hilux',
  },
  typeCarburant: LgTypeCarburant.GASOIL,
  volumeLitres: 50,
  prixUnitaire: 4500,
  montantTotal: 225000,
  kilometrage: 12450,
  station: 'Station Total',
  notes: null,
  dateApprovisionnement: new Date('2026-05-15'),
  requestorId: 10,
  requestor: {
    id: 10,
    email: 'user@example.com',
    name: 'Test User',
    role: 'DEMANDEUR',
  },
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CarburantService', () => {
  let service: CarburantService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarburantService,
        { provide: CarburantRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<CarburantService>(CarburantService);
  });

  describe('create', () => {
    const dto = {
      vehicleId: 'vehicle-1',
      dateApprovisionnement: '2026-05-15',
      typeCarburant: LgTypeCarburant.GASOIL,
      volumeLitres: 50,
      montantTotal: 225000,
    };

    it('creates an approvisionnement with a generated reference', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue(BASE_VEHICLE);
      mockRepository.generateNextReference.mockResolvedValue('CAR-2026-0001');
      mockRepository.create.mockResolvedValue(BASE_CARBURANT);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.create(dto, 10);
      expect(result.reference).toBe('CAR-2026-0001');
      expect(mockRepository.generateNextReference).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('links the requester uploaded receipts', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue(BASE_VEHICLE);
      mockRepository.generateNextReference.mockResolvedValue('CAR-2026-0001');
      mockRepository.create.mockResolvedValue(BASE_CARBURANT);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.file.count.mockResolvedValue(1);

      await service.create({ ...dto, fileIds: [5] }, 10);

      expect(mockPrisma.file.count).toHaveBeenCalledWith({
        where: { id: { in: [5] }, uploadedById: 10 },
      });
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ files: { connect: [{ id: 5 }] } }),
      );
    });

    it('rejects files uploaded by someone else', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue(BASE_VEHICLE);
      mockPrisma.file.count.mockResolvedValue(0);

      await expect(
        service.create({ ...dto, fileIds: [5] }, 10),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('throws 422 when vehicle does not exist', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, 10)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws 422 when vehicle is not ACTIF', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        ...BASE_VEHICLE,
        statut: VehicleStatut.ARCHIVE,
      });

      await expect(service.create(dto, 10)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('does not throw when notification fails', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue(BASE_VEHICLE);
      mockRepository.generateNextReference.mockResolvedValue('CAR-2026-0001');
      mockRepository.create.mockResolvedValue(BASE_CARBURANT);
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'admin@test.com' }]);
      mockNotification.createNotification.mockRejectedValue(
        new Error('Mail error'),
      );

      const result = await service.create(dto, 10);
      expect(result).toBeDefined();
    });
  });

  describe('findById', () => {
    it('returns carburant to ADMIN regardless of ownership', async () => {
      mockRepository.findById.mockResolvedValue(BASE_CARBURANT);
      const result = await service.findById('car-1', {
        id: 99,
        role: 'ADMIN',
      });
      expect(result).toEqual(BASE_CARBURANT);
    });

    it('returns carburant when caller is the owner DEMANDEUR', async () => {
      mockRepository.findById.mockResolvedValue(BASE_CARBURANT);
      const result = await service.findById('car-1', {
        id: 10,
        role: 'DEMANDEUR',
      });
      expect(result).toEqual(BASE_CARBURANT);
    });

    it('throws ForbiddenException when DEMANDEUR is not owner', async () => {
      mockRepository.findById.mockResolvedValue(BASE_CARBURANT);
      await expect(
        service.findById('car-1', { id: 99, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when carburant does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(
        service.findById('car-999', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('cancels a PENDING entry when caller is the owner DEMANDEUR', async () => {
      mockRepository.findById.mockResolvedValue(BASE_CARBURANT);
      mockRepository.updateStatus.mockResolvedValue({
        ...BASE_CARBURANT,
        status: LgCarburantStatus.CANCELLED,
      });
      mockNotification.createNotification.mockResolvedValue({});

      const result = await service.cancel('car-1', {
        id: 10,
        role: 'DEMANDEUR',
      });
      expect(result.status).toBe(LgCarburantStatus.CANCELLED);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        'car-1',
        'CANCELLED',
      );
    });

    it('throws 422 when carburant status is PROCESSED', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_CARBURANT,
        status: LgCarburantStatus.PROCESSED,
      });
      await expect(
        service.cancel('car-1', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 when carburant status is CANCELLED', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_CARBURANT,
        status: LgCarburantStatus.CANCELLED,
      });
      await expect(
        service.cancel('car-1', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws ForbiddenException when DEMANDEUR is not the owner', async () => {
      mockRepository.findById.mockResolvedValue(BASE_CARBURANT);
      await expect(
        service.cancel('car-1', { id: 99, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to cancel any PENDING entry', async () => {
      mockRepository.findById.mockResolvedValue(BASE_CARBURANT);
      mockRepository.updateStatus.mockResolvedValue({
        ...BASE_CARBURANT,
        status: LgCarburantStatus.CANCELLED,
      });

      const result = await service.cancel('car-1', { id: 1, role: 'ADMIN' });
      expect(result.status).toBe(LgCarburantStatus.CANCELLED);
    });
  });

  describe('getStats', () => {
    it('returns aggregateStats result', async () => {
      const stats = {
        byStatus: { PENDING: 5, PROCESSED: 3, CANCELLED: 1 },
        totalVolumeLitres: 1200,
        totalMontantMGA: 5400000,
        byTypeCarburant: { GASOIL: 6, ESSENCE: 3 },
      };
      mockRepository.aggregateStats.mockResolvedValue(stats);

      const result = await service.getStats();
      expect(result).toEqual(stats);
    });
  });

  describe('computeConsumption', () => {
    it('uses litres of all refuels but the first over the km span', () => {
      expect(
        computeConsumption([
          { kilometrage: 10800, volumeLitres: 42 },
          { kilometrage: 10000, volumeLitres: 50 },
          { kilometrage: null, volumeLitres: 30 },
          { kilometrage: 10400, volumeLitres: 40 },
        ]),
      ).toEqual({ distanceKm: 800, litresPer100Km: 10.25 });
    });

    it('returns null with fewer than 2 km readings', () => {
      expect(
        computeConsumption([{ kilometrage: 10000, volumeLitres: 50 }]),
      ).toEqual({ distanceKm: 0, litresPer100Km: null });
    });
  });

  describe('getConsumption', () => {
    it('groups by vehicle with totals', async () => {
      const vehicle = {
        immatriculation: 'IM-001-T',
        marque: 'Toyota',
        modele: 'Hilux',
      };
      mockRepository.findForConsumption.mockResolvedValue([
        {
          vehicleId: 'v1',
          volumeLitres: 50,
          montantTotal: 1000,
          kilometrage: 1000,
          dateApprovisionnement: new Date('2026-01-01'),
          vehicle,
        },
        {
          vehicleId: 'v1',
          volumeLitres: 20,
          montantTotal: 400,
          kilometrage: 1200,
          dateApprovisionnement: new Date('2026-02-01'),
          vehicle,
        },
      ]);

      const [row] = await service.getConsumption({
        typeCarburant: LgTypeCarburant.GASOIL,
        dateFrom: '2026-01-01',
      });
      expect(mockRepository.findForConsumption).toHaveBeenCalledWith({
        vehicleId: undefined,
        typeCarburant: LgTypeCarburant.GASOIL,
        dateFrom: new Date('2026-01-01'),
        dateTo: undefined,
      });
      expect(row).toMatchObject({
        vehicleId: 'v1',
        immatriculation: 'IM-001-T',
        refuelCount: 2,
        totalLitres: 70,
        totalAmount: 1400,
        distanceKm: 200,
        litresPer100Km: 10,
        lastRefuelDate: new Date('2026-02-01'),
      });
    });
  });
});
