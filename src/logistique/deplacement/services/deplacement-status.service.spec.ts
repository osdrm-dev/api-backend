import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DeplacementStatusService } from './deplacement-status.service';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { LgDeplacementStatus, LgTypeMission } from '@prisma/client';

const mockRepository = {
  findById: jest.fn(),
  updateStatus: jest.fn(),
};

const mockNotification = {
  createNotification: jest.fn(),
};

const BASE_DEP = {
  id: 'dep-1',
  reference: 'DEP-2026-0001',
  status: LgDeplacementStatus.EN_ATTENTE,
  requestor: { id: 10, email: 'user@test.com', name: 'Test' },
  typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
};

describe('DeplacementStatusService', () => {
  let service: DeplacementStatusService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeplacementStatusService,
        { provide: DeplacementRepository, useValue: mockRepository },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<DeplacementStatusService>(DeplacementStatusService);
  });

  it('throws 404 when deplacement not found', async () => {
    mockRepository.findById.mockResolvedValue(null);
    await expect(
      service.updateStatus(
        'dep-999',
        { status: LgDeplacementStatus.REFUSEE },
        1,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 422 for invalid transition (EN_ATTENTE → EN_COURS)', async () => {
    mockRepository.findById.mockResolvedValue(BASE_DEP);
    await expect(
      service.updateStatus(
        'dep-1',
        { status: LgDeplacementStatus.EN_COURS },
        1,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws 422 when REFUSEE without motifRefus', async () => {
    mockRepository.findById.mockResolvedValue(BASE_DEP);
    await expect(
      service.updateStatus('dep-1', { status: LgDeplacementStatus.REFUSEE }, 1),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('allows valid transition EN_ATTENTE → REFUSEE with motifRefus', async () => {
    mockRepository.findById.mockResolvedValue(BASE_DEP);
    mockRepository.updateStatus.mockResolvedValue({
      ...BASE_DEP,
      status: 'REFUSEE',
    });
    mockNotification.createNotification.mockResolvedValue({});

    const result = await service.updateStatus(
      'dep-1',
      { status: LgDeplacementStatus.REFUSEE, motifRefus: 'Pas de véhicule.' },
      1,
    );
    expect(result.status).toBe('REFUSEE');
    expect(mockNotification.createNotification).toHaveBeenCalledWith(
      'DEPLACEMENT_STATUS_CHANGED',
      ['user@test.com'],
      'dep-1',
      expect.objectContaining({ newStatus: 'REFUSEE' }),
      false,
    );
  });

  it('allows valid transition EN_ATTENTE → VEHICULE_ATTRIBUE and fires notification', async () => {
    mockRepository.findById.mockResolvedValue(BASE_DEP);
    mockRepository.updateStatus.mockResolvedValue({
      ...BASE_DEP,
      status: 'VEHICULE_ATTRIBUE',
    });
    mockNotification.createNotification.mockResolvedValue({});

    const result = await service.updateStatus(
      'dep-1',
      { status: LgDeplacementStatus.VEHICULE_ATTRIBUE },
      1,
    );
    expect(result.status).toBe('VEHICULE_ATTRIBUE');
    expect(mockNotification.createNotification).toHaveBeenCalled();
  });

  it('allows terminal state transitions to fail (LIQUIDEE → anything)', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_DEP,
      status: LgDeplacementStatus.LIQUIDEE,
    });
    await expect(
      service.updateStatus('dep-1', { status: LgDeplacementStatus.ANNULEE }, 1),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('does not fire notification for EN_COURS transition', async () => {
    mockRepository.findById.mockResolvedValue({
      ...BASE_DEP,
      status: LgDeplacementStatus.CONFIRMEE,
    });
    mockRepository.updateStatus.mockResolvedValue({
      ...BASE_DEP,
      status: 'EN_COURS',
    });

    await service.updateStatus(
      'dep-1',
      { status: LgDeplacementStatus.EN_COURS },
      1,
    );
    expect(mockNotification.createNotification).not.toHaveBeenCalled();
  });
});
