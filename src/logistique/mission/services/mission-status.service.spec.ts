import { Test, TestingModule } from '@nestjs/testing';
import { MissionStatusService } from './mission-status.service';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { LgMissionStatus, LgMissionType } from '@prisma/client';
import { ErrorCode } from 'src/common/errors';

const mockRepository = {
  findById: jest.fn(),
  updateStatus: jest.fn(),
};

const mockNotification = {
  createNotification: jest.fn(),
};

const BASE_MISSION = {
  id: 'mission-1',
  reference: 'TRJ-2026-0001',
  status: LgMissionStatus.PENDING,
  requestor: { id: 10, email: 'user@test.com', name: 'Test' },
  missionType: LgMissionType.NATIONAL,
};

describe('MissionStatusService', () => {
  let service: MissionStatusService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissionStatusService,
        { provide: MissionRepository, useValue: mockRepository },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<MissionStatusService>(MissionStatusService);
  });

  it('throws 404 when mission not found', async () => {
    mockRepository.findById.mockResolvedValue(null);
    await expect(
      service.updateStatus(
        'mission-999',
        { status: LgMissionStatus.REJECTED },
        1,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it('throws 422 for invalid transition (PENDING → IN_PROGRESS)', async () => {
    mockRepository.findById.mockResolvedValue(BASE_MISSION);
    await expect(
      service.updateStatus(
        'mission-1',
        { status: LgMissionStatus.IN_PROGRESS },
        1,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.MISSION_STATUS_TRANSITION_INVALID,
    });
  });

  it('throws 422 when REJECTED without rejectionReason', async () => {
    mockRepository.findById.mockResolvedValue(BASE_MISSION);
    await expect(
      service.updateStatus(
        'mission-1',
        { status: LgMissionStatus.REJECTED },
        1,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.MISSION_REJECTION_REASON_REQUIRED,
    });
  });

  it('allows valid transition PENDING → REJECTED with rejectionReason', async () => {
    mockRepository.findById.mockResolvedValue(BASE_MISSION);
    mockRepository.updateStatus.mockResolvedValue({
      ...BASE_MISSION,
      status: 'REJECTED',
    });
    mockNotification.createNotification.mockResolvedValue({});

    const result = await service.updateStatus(
      'mission-1',
      { status: LgMissionStatus.REJECTED, rejectionReason: 'Pas de véhicule.' },
      1,
    );
    expect(result.status).toBe('REJECTED');
    expect(mockNotification.createNotification).toHaveBeenCalledWith(
      'MISSION_STATUS_CHANGED',
      ['user@test.com'],
      'mission-1',
      expect.objectContaining({ newStatus: 'REJECTED' }),
      false,
    );
  });

  it('allows valid transition PENDING → VEHICLE_ASSIGNED and fires notification', async () => {
    mockRepository.findById.mockResolvedValue(BASE_MISSION);
    mockRepository.updateStatus.mockResolvedValue({
      ...BASE_MISSION,
      status: 'VEHICLE_ASSIGNED',
    });
    mockNotification.createNotification.mockResolvedValue({});

    const result = await service.updateStatus(
      'mission-1',
      { status: LgMissionStatus.VEHICLE_ASSIGNED },
      1,
    );
    expect(result.status).toBe('VEHICLE_ASSIGNED');
    expect(mockNotification.createNotification).toHaveBeenCalled();
  });

  it('allows terminal state transitions to fail (SETTLED → anything)', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_MISSION,
      status: LgMissionStatus.SETTLED,
    });
    await expect(
      service.updateStatus(
        'mission-1',
        { status: LgMissionStatus.CANCELLED },
        1,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.MISSION_STATUS_TRANSITION_INVALID,
    });
  });

  it('does not fire notification for IN_PROGRESS transition', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_MISSION,
      status: LgMissionStatus.CONFIRMED,
    });
    mockRepository.updateStatus.mockResolvedValue({
      ...BASE_MISSION,
      status: 'IN_PROGRESS',
    });

    await service.updateStatus(
      'mission-1',
      { status: LgMissionStatus.IN_PROGRESS },
      1,
    );
    expect(mockNotification.createNotification).not.toHaveBeenCalled();
  });
});
