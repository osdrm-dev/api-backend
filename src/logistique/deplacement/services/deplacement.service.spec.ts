import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DeplacementService } from './deplacement.service';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { LgDeplacementStatus, LgTypeMission } from '@prisma/client';
import * as deadlineUtil from '../utils/thursday-deadline.util';

const mockRepository = {
  generateNextReference: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  findManyByRequestor: jest.fn(),
  updateStatus: jest.fn(),
  countByStatus: jest.fn(),
};

const mockPrisma = {
  user: { findMany: jest.fn() },
};

const mockNotification = {
  createNotification: jest.fn(),
};

const BASE_DEPLACEMENT = {
  id: 'dep-1',
  reference: 'DEP-2026-0001',
  objet: 'Mission terrain',
  destination: 'Fianarantsoa',
  dateDepart: new Date('2026-05-11T00:00:00.000Z'),
  dateRetour: new Date('2026-05-14T00:00:00.000Z'),
  typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
  nombrePersonnes: 1,
  passagers: [],
  status: LgDeplacementStatus.EN_ATTENTE,
  requestorId: 10,
  requestor: { id: 10, email: 'user@example.com', name: 'Test User' },
  deletedAt: null,
  liquidation: null,
};

describe('DeplacementService', () => {
  let service: DeplacementService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeplacementService,
        { provide: DeplacementRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<DeplacementService>(DeplacementService);
  });

  describe('create', () => {
    const dto = {
      objet: 'Mission terrain',
      destination: 'Fianarantsoa',
      dateDepart: '2026-05-11',
      dateRetour: '2026-05-14',
      typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
    };

    it('creates a deplacement and fires DEPLACEMENT_NOUVEAU notification', async () => {
      jest.spyOn(deadlineUtil, 'isAfterDeadline').mockReturnValue(false);
      mockRepository.generateNextReference.mockResolvedValue('DEP-2026-0001');
      mockRepository.create.mockResolvedValue(BASE_DEPLACEMENT);
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'gp@test.com' }]);
      mockNotification.createNotification.mockResolvedValue({});

      const result = await service.create(dto, 10, false);
      expect(result.reference).toBe('DEP-2026-0001');
      expect(mockNotification.createNotification).toHaveBeenCalledWith(
        'DEPLACEMENT_NOUVEAU',
        ['gp@test.com'],
        'dep-1',
        expect.any(Object),
        false,
      );
    });

    it('throws 422 when dateRetour < dateDepart', async () => {
      await expect(
        service.create({ ...dto, dateRetour: '2026-05-10' }, 10, false),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 when deadline is exceeded', async () => {
      jest.spyOn(deadlineUtil, 'isAfterDeadline').mockReturnValue(true);
      await expect(service.create(dto, 10, false)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('bypasses deadline check when bypassDeadline=true', async () => {
      jest.spyOn(deadlineUtil, 'isAfterDeadline').mockReturnValue(true);
      mockRepository.generateNextReference.mockResolvedValue('DEP-2026-0001');
      mockRepository.create.mockResolvedValue(BASE_DEPLACEMENT);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.create(dto, 10, true);
      expect(result).toBeDefined();
    });
  });

  describe('findById', () => {
    it('returns deplacement to its requestor', async () => {
      mockRepository.findById.mockResolvedValue(BASE_DEPLACEMENT);
      const result = await service.findById('dep-1', {
        id: 10,
        role: 'DEMANDEUR',
      });
      expect(result).toEqual(BASE_DEPLACEMENT);
    });

    it('throws 404 when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(
        service.findById('dep-999', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws 403 when DEMANDEUR accesses another user's request", async () => {
      mockRepository.findById.mockResolvedValue(BASE_DEPLACEMENT);
      await expect(
        service.findById('dep-1', { id: 99, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows GESTIONNAIRE_PARC to access any request', async () => {
      mockRepository.findById.mockResolvedValue(BASE_DEPLACEMENT);
      const result = await service.findById('dep-1', {
        id: 99,
        role: 'GESTIONNAIRE_PARC',
      });
      expect(result).toEqual(BASE_DEPLACEMENT);
    });
  });

  describe('cancel', () => {
    it('allows DEMANDEUR to cancel own EN_ATTENTE request', async () => {
      mockRepository.findById.mockResolvedValue(BASE_DEPLACEMENT);
      mockRepository.updateStatus.mockResolvedValue({
        ...BASE_DEPLACEMENT,
        status: 'ANNULEE',
      });
      mockNotification.createNotification.mockResolvedValue({});

      const result = await service.cancel('dep-1', {
        id: 10,
        role: 'DEMANDEUR',
      });
      expect(result.status).toBe('ANNULEE');
    });

    it("throws 403 when DEMANDEUR tries to cancel another user's request", async () => {
      mockRepository.findById.mockResolvedValue(BASE_DEPLACEMENT);
      await expect(
        service.cancel('dep-1', { id: 99, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 422 when trying to cancel a terminal LIQUIDEE request', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_DEPLACEMENT,
        status: 'LIQUIDEE',
      });
      await expect(
        service.cancel('dep-1', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 403 when DEMANDEUR tries to cancel a CONFIRMEE request', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_DEPLACEMENT,
        status: 'CONFIRMEE',
      });
      await expect(
        service.cancel('dep-1', { id: 10, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to cancel a CONFIRMEE request', async () => {
      mockRepository.findById.mockResolvedValue({
        ...BASE_DEPLACEMENT,
        status: 'CONFIRMEE',
      });
      mockRepository.updateStatus.mockResolvedValue({
        ...BASE_DEPLACEMENT,
        status: 'ANNULEE',
      });
      mockNotification.createNotification.mockResolvedValue({});

      const result = await service.cancel('dep-1', { id: 1, role: 'ADMIN' });
      expect(result.status).toBe('ANNULEE');
    });
  });
});
