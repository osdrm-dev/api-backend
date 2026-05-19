import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LgTripStatus, LgTransportMode } from '@prisma/client';
import { TripStatusService } from '../trip-status.service';
import { TripRepository } from 'src/repository/trip/trip.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';

const mockRepository = {
  findById: jest.fn(),
  updateStatus: jest.fn(),
};

const mockNotification = {
  createNotification: jest.fn(),
};

const BASE_TRIP = {
  id: 'trip-1',
  reference: 'TRJ-2026-0001',
  status: LgTripStatus.PENDING,
  transportMode: LgTransportMode.TAXI,
  requestor: {
    id: 10,
    email: 'user@test.com',
    name: 'Test',
    role: 'DEMANDEUR',
  },
  requestorId: 10,
};

// ADMIN guard is enforced at controller level via @Roles('ADMIN')

describe('TripStatusService', () => {
  let service: TripStatusService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripStatusService,
        { provide: TripRepository, useValue: mockRepository },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<TripStatusService>(TripStatusService);
  });

  it('throws NotFoundException when trip does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);
    await expect(
      service.updateStatus('trip-999', LgTripStatus.PROCESSED),
    ).rejects.toThrow(NotFoundException);
  });

  it('transitions PENDING → PROCESSED successfully', async () => {
    mockRepository.findById.mockResolvedValue(BASE_TRIP);
    mockRepository.updateStatus.mockResolvedValue({
      ...BASE_TRIP,
      status: LgTripStatus.PROCESSED,
    });
    mockNotification.createNotification.mockResolvedValue({});

    const result = await service.updateStatus('trip-1', LgTripStatus.PROCESSED);
    expect(result.status).toBe(LgTripStatus.PROCESSED);
    expect(mockRepository.updateStatus).toHaveBeenCalledWith(
      'trip-1',
      LgTripStatus.PROCESSED,
    );
  });

  it('transitions PENDING → CANCELLED successfully', async () => {
    mockRepository.findById.mockResolvedValue(BASE_TRIP);
    mockRepository.updateStatus.mockResolvedValue({
      ...BASE_TRIP,
      status: LgTripStatus.CANCELLED,
    });

    const result = await service.updateStatus('trip-1', LgTripStatus.CANCELLED);
    expect(result.status).toBe(LgTripStatus.CANCELLED);
  });

  it('throws 422 when transitioning from PROCESSED (terminal)', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_TRIP,
      status: LgTripStatus.PROCESSED,
    });
    await expect(
      service.updateStatus('trip-1', LgTripStatus.PENDING),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws 422 when transitioning from CANCELLED (terminal)', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_TRIP,
      status: LgTripStatus.CANCELLED,
    });
    await expect(
      service.updateStatus('trip-1', LgTripStatus.PROCESSED),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('fires TRIP_STATUS_CHANGED notification when requestor has email', async () => {
    mockRepository.findById.mockResolvedValue(BASE_TRIP);
    mockRepository.updateStatus.mockResolvedValue({
      ...BASE_TRIP,
      status: LgTripStatus.PROCESSED,
    });
    mockNotification.createNotification.mockResolvedValue({});

    await service.updateStatus('trip-1', LgTripStatus.PROCESSED);
    expect(mockNotification.createNotification).toHaveBeenCalledWith(
      'TRIP_STATUS_CHANGED',
      ['user@test.com'],
      'trip-1',
      expect.objectContaining({ newStatus: LgTripStatus.PROCESSED }),
      false,
    );
  });
});
