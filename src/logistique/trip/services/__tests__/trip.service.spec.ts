import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LgTripStatus, LgTransportMode } from '@prisma/client';
import { TripService } from '../trip.service';
import { TripRepository } from 'src/repository/trip/trip.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';

const mockRepository = {
  generateNextReference: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  findManyByRequestor: jest.fn(),
  updateStatus: jest.fn(),
  countByStatus: jest.fn(),
};

const mockNotification = {
  createNotification: jest.fn(),
};

const BASE_TRIP = {
  id: 'trip-1',
  reference: 'TRJ-2026-0001',
  status: LgTripStatus.PENDING,
  departureLocation: 'Antananarivo',
  arrivalLocation: 'Fianarantsoa',
  departureDate: new Date('2026-05-20'),
  arrivalDate: new Date('2026-05-21'),
  purpose: 'Réunion de coordination',
  transportMode: LgTransportMode.SERVICE_VEHICLE,
  requestorId: 10,
  requestor: {
    id: 10,
    email: 'user@example.com',
    name: 'Test User',
    role: 'DEMANDEUR',
  },
  deletedAt: null,
};

describe('TripService', () => {
  let service: TripService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripService,
        { provide: TripRepository, useValue: mockRepository },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<TripService>(TripService);
  });

  describe('create', () => {
    const dto = {
      departureLocation: 'Antananarivo',
      arrivalLocation: 'Fianarantsoa',
      departureDate: '2026-05-20',
      arrivalDate: '2026-05-21',
      purpose: 'Réunion de coordination',
      transportMode: LgTransportMode.SERVICE_VEHICLE,
    };

    it('creates a trip with a generated reference', async () => {
      mockRepository.generateNextReference.mockResolvedValue('TRJ-2026-0001');
      mockRepository.create.mockResolvedValue(BASE_TRIP);
      mockNotification.createNotification.mockResolvedValue({});

      const result = await service.create(dto, 10);
      expect(result.reference).toBe('TRJ-2026-0001');
      expect(mockRepository.generateNextReference).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('throws 422 when arrivalDate < departureDate', async () => {
      await expect(
        service.create({ ...dto, arrivalDate: '2026-05-19' }, 10),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('does not throw when arrivalDate equals departureDate', async () => {
      mockRepository.generateNextReference.mockResolvedValue('TRJ-2026-0001');
      mockRepository.create.mockResolvedValue(BASE_TRIP);

      const result = await service.create(
        { ...dto, arrivalDate: '2026-05-20' },
        10,
      );
      expect(result).toBeDefined();
    });

    it('does not throw when arrivalDate is omitted', async () => {
      mockRepository.generateNextReference.mockResolvedValue('TRJ-2026-0001');
      mockRepository.create.mockResolvedValue(BASE_TRIP);
      const { arrivalDate: _omit, ...dtoWithoutArrival } = dto;

      const result = await service.create(dtoWithoutArrival, 10);
      expect(result).toBeDefined();
    });
  });

  describe('findById', () => {
    it('returns trip to ADMIN regardless of ownership', async () => {
      mockRepository.findById.mockResolvedValue(BASE_TRIP);
      const result = await service.findById('trip-1', {
        id: 99,
        role: 'ADMIN',
      });
      expect(result).toEqual(BASE_TRIP);
    });

    it('returns trip when caller is the owner DEMANDEUR', async () => {
      mockRepository.findById.mockResolvedValue(BASE_TRIP);
      const result = await service.findById('trip-1', {
        id: 10,
        role: 'DEMANDEUR',
      });
      expect(result).toEqual(BASE_TRIP);
    });

    it('throws ForbiddenException when DEMANDEUR is not owner', async () => {
      mockRepository.findById.mockResolvedValue(BASE_TRIP);
      await expect(
        service.findById('trip-1', { id: 99, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when trip does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(
        service.findById('trip-999', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('cancels a PENDING trip when caller is the owner DEMANDEUR', async () => {
      mockRepository.findById.mockResolvedValue(BASE_TRIP);
      mockRepository.updateStatus.mockResolvedValue({
        ...BASE_TRIP,
        status: LgTripStatus.CANCELLED,
      });
      mockNotification.createNotification.mockResolvedValue({});

      const result = await service.cancel('trip-1', {
        id: 10,
        role: 'DEMANDEUR',
      });
      expect(result.status).toBe(LgTripStatus.CANCELLED);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        'trip-1',
        'CANCELLED',
      );
    });

    it('throws 422 when trip status is PROCESSED', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_TRIP,
        status: LgTripStatus.PROCESSED,
      });
      await expect(
        service.cancel('trip-1', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 when trip status is CANCELLED', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_TRIP,
        status: LgTripStatus.CANCELLED,
      });
      await expect(
        service.cancel('trip-1', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws ForbiddenException when DEMANDEUR is not the owner', async () => {
      mockRepository.findById.mockResolvedValue(BASE_TRIP);
      await expect(
        service.cancel('trip-1', { id: 99, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to cancel any PENDING trip', async () => {
      mockRepository.findById.mockResolvedValue(BASE_TRIP);
      mockRepository.updateStatus.mockResolvedValue({
        ...BASE_TRIP,
        status: LgTripStatus.CANCELLED,
      });

      const result = await service.cancel('trip-1', { id: 1, role: 'ADMIN' });
      expect(result.status).toBe(LgTripStatus.CANCELLED);
    });
  });

  describe('getStats', () => {
    it('returns countByStatus result', async () => {
      const stats = { PENDING: 5, PROCESSED: 3, CANCELLED: 1 };
      mockRepository.countByStatus.mockResolvedValue(stats);

      const result = await service.getStats();
      expect(result).toEqual(stats);
    });
  });
});
