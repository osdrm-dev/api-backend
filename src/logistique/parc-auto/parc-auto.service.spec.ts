import { Test, TestingModule } from '@nestjs/testing';
import { Role, VehicleAssignmentStatus, VehicleStatut } from '@prisma/client';
import { ParcAutoService } from './parc-auto.service';
import { ParcAutoRepository } from 'src/repository/parc-auto/parc-auto.repository';
import { UserRepository } from 'src/repository/user/user.repository';
import { FileStorageService } from 'src/storage/services/file-storage.service';
import { ErrorCode } from 'src/common/errors';

const repo = {
  findById: jest.fn(),
  findAssignmentById: jest.fn(),
  findConflictingAssignment: jest.fn(),
  createAssignmentClosingPrevious: jest.fn(),
  endAssignment: jest.fn(),
};
const userRepo = { findById: jest.fn() };
const fileStorage = { upload: jest.fn() };

const pdf = { mimetype: 'application/pdf' } as any;
const driver = { id: 7, role: Role.DRIVER, isActive: true };

describe('ParcAutoService — affectations', () => {
  let service: ParcAutoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.findById.mockResolvedValue({
      id: 'veh-1',
      statut: VehicleStatut.ACTIF,
    });
    userRepo.findById.mockResolvedValue(driver);
    fileStorage.upload.mockResolvedValue({ id: 99 });
    repo.findConflictingAssignment.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParcAutoService,
        { provide: ParcAutoRepository, useValue: repo },
        { provide: UserRepository, useValue: userRepo },
        { provide: FileStorageService, useValue: fileStorage },
      ],
    }).compile();
    service = module.get(ParcAutoService);
  });

  describe('createAssignment', () => {
    it('rejects missing file', async () => {
      await expect(
        service.createAssignment('veh-1', undefined, { driverId: 7 }, 1),
      ).rejects.toMatchObject({
        code: ErrorCode.VEHICLE_ASSIGNMENT_FORM_REQUIRED,
      });
      expect(fileStorage.upload).not.toHaveBeenCalled();
    });

    it('rejects archived vehicle', async () => {
      repo.findById.mockResolvedValue({
        id: 'veh-1',
        statut: VehicleStatut.ARCHIVE,
      });
      await expect(
        service.createAssignment('veh-1', pdf, { driverId: 7 }, 1),
      ).rejects.toMatchObject({
        code: ErrorCode.VEHICLE_ARCHIVED_CANNOT_ASSIGN,
      });
    });

    it('rejects user that is not DRIVER', async () => {
      userRepo.findById.mockResolvedValue({ ...driver, role: Role.ACHETEUR });
      await expect(
        service.createAssignment('veh-1', pdf, { driverId: 7 }, 1),
      ).rejects.toMatchObject({ code: ErrorCode.VEHICLE_DRIVER_INVALID });
    });

    it('rejects inactive driver', async () => {
      userRepo.findById.mockResolvedValue({ ...driver, isActive: false });
      await expect(
        service.createAssignment('veh-1', pdf, { driverId: 7 }, 1),
      ).rejects.toMatchObject({ code: ErrorCode.VEHICLE_DRIVER_INVALID });
    });

    it('rejects future startDate', async () => {
      const future = new Date(Date.now() + 2 * 86400000).toISOString();
      await expect(
        service.createAssignment(
          'veh-1',
          pdf,
          { driverId: 7, startDate: future },
          1,
        ),
      ).rejects.toMatchObject({
        code: ErrorCode.VEHICLE_ASSIGNMENT_START_IN_FUTURE,
      });
      expect(fileStorage.upload).not.toHaveBeenCalled();
    });

    it('rejects startDate before an existing assignment period ends', async () => {
      repo.findConflictingAssignment.mockResolvedValue({ id: 'as-old' });
      await expect(
        service.createAssignment(
          'veh-1',
          pdf,
          { driverId: 7, startDate: '2026-10-10' },
          1,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.VEHICLE_ASSIGNMENT_OVERLAP });
      expect(repo.findConflictingAssignment).toHaveBeenCalledWith(
        'veh-1',
        7,
        new Date('2026-10-10'),
      );
      expect(fileStorage.upload).not.toHaveBeenCalled();
    });

    it('closes previous driver assignment', async () => {
      await service.createAssignment(
        'veh-1',
        pdf,
        { driverId: 7, startDate: '2026-10-01', notes: 'x' },
        1,
      );
      expect(repo.createAssignmentClosingPrevious).toHaveBeenCalledWith({
        vehicleId: 'veh-1',
        driverId: 7,
        fileId: 99,
        startDate: new Date('2026-10-01'),
        notes: 'x',
        createdById: 1,
      });
    });
  });

  describe('endAssignment', () => {
    const active = {
      id: 'as-1',
      vehicleId: 'veh-1',
      status: VehicleAssignmentStatus.ACTIVE,
      startDate: new Date('2026-10-01'),
    };

    it('rejects already TERMINEE', async () => {
      repo.findAssignmentById.mockResolvedValue({
        ...active,
        status: VehicleAssignmentStatus.TERMINEE,
      });
      await expect(
        service.endAssignment('veh-1', 'as-1', {}),
      ).rejects.toMatchObject({
        code: ErrorCode.VEHICLE_ASSIGNMENT_ALREADY_ENDED,
      });
    });

    it('rejects endDate < startDate', async () => {
      repo.findAssignmentById.mockResolvedValue(active);
      await expect(
        service.endAssignment('veh-1', 'as-1', { endDate: '2026-09-01' }),
      ).rejects.toMatchObject({
        code: ErrorCode.VEHICLE_ASSIGNMENT_END_BEFORE_START,
      });
    });

    it('rejects assignment of another vehicle', async () => {
      repo.findAssignmentById.mockResolvedValue({
        ...active,
        vehicleId: 'veh-2',
      });
      await expect(
        service.endAssignment('veh-1', 'as-1', {}),
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });

    it('ends active assignment at given date', async () => {
      repo.findAssignmentById.mockResolvedValue(active);
      await service.endAssignment('veh-1', 'as-1', { endDate: '2026-10-15' });
      expect(repo.endAssignment).toHaveBeenCalledWith(
        'as-1',
        new Date('2026-10-15'),
      );
    });
  });
});
