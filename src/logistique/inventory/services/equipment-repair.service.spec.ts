import { Test, TestingModule } from '@nestjs/testing';
import { EquipmentStatus, MaintenanceInterventionType } from '@prisma/client';
import { EquipmentRepairService } from './equipment-repair.service';
import { MaintenanceService } from 'src/maintenance/services/maintenance.service';
import { PrismaService } from 'prisma/prisma.service';
import { ErrorCode } from 'src/common/errors';

const maintenance = {
  createRequest: jest.fn(),
  getAllForRequestor: jest.fn(),
  getAllAdmin: jest.fn(),
};
const prisma = {
  equipment: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
};

const equipment = {
  id: 'e1',
  designation: 'iPhone 17',
  inventoryReference: 'INV-0001',
  location: 'Siège',
  archivedAt: null,
  attributions: [{ beneficiaryId: 3, status: 'ACTIVE' }],
};

describe('EquipmentRepairService', () => {
  let service: EquipmentRepairService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.equipment.findUnique.mockResolvedValue(equipment);
    maintenance.createRequest.mockResolvedValue({ id: 'm1' });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentRepairService,
        { provide: MaintenanceService, useValue: maintenance },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(EquipmentRepairService);
  });

  it('creates a REPARATION request linked to the equipment and marks it EN_PANNE', async () => {
    await service.create(
      { id: 3, role: 'DEMANDEUR' },
      { equipmentId: 'e1', description: "L'écran ne s'allume plus" },
    );
    expect(maintenance.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        interventionType: MaintenanceInterventionType.REPARATION,
        description: "L'écran ne s'allume plus",
        title: 'Panne — iPhone 17 (INV-0001)',
        location: 'Siège',
      }),
      3,
      'e1',
    );
    expect(prisma.equipment.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { status: EquipmentStatus.EN_PANNE },
    });
  });

  it('forwards attached documents to the maintenance request', async () => {
    await service.create(
      { id: 3, role: 'DEMANDEUR' },
      { equipmentId: 'e1', description: 'Écran cassé', fileIds: [12] },
    );
    expect(maintenance.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attachmentIds: [12] } }),
      3,
      'e1',
    );
  });

  it('refuses equipment not attributed to the user', async () => {
    await expect(
      service.create(
        { id: 99, role: 'DEMANDEUR' },
        { equipmentId: 'e1', description: 'x' },
      ),
    ).rejects.toMatchObject({ code: ErrorCode.EQUIPMENT_REPAIR_NOT_HOLDER });
    expect(maintenance.createRequest).not.toHaveBeenCalled();
    expect(prisma.equipment.update).not.toHaveBeenCalled();
  });

  it('lets an ADMIN declare a repair on any equipment', async () => {
    await service.create(
      { id: 1, role: 'ADMIN' },
      { equipmentId: 'e1', description: 'x' },
    );
    expect(maintenance.createRequest).toHaveBeenCalled();
  });

  it('refuses unknown or archived equipment', async () => {
    prisma.equipment.findUnique.mockResolvedValue({
      ...equipment,
      archivedAt: new Date(),
    });
    await expect(
      service.create(
        { id: 3, role: 'DEMANDEUR' },
        { equipmentId: 'e1', description: 'x' },
      ),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it('lists only equipment repairs of the requestor', async () => {
    await service.findMine(3, {});
    expect(maintenance.getAllForRequestor).toHaveBeenCalledWith(
      3,
      {},
      'EQUIPMENT_ONLY',
    );
  });
});
