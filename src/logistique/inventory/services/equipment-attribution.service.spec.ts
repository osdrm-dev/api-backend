import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EquipmentStatus } from '@prisma/client';
import { EquipmentAttributionService } from './equipment-attribution.service';
import { EquipmentAttributionRepository } from 'src/repository/inventory/equipment-attribution.repository';
import { EquipmentRepository } from 'src/repository/inventory/equipment.repository';
import { PrismaService } from 'prisma/prisma.service';

const equipmentRepo = { findById: jest.fn() };
const tx = { equipmentAttribution: { create: jest.fn(), count: jest.fn() } };
const prisma = { $transaction: jest.fn((fn, _opts?) => fn(tx)) };

const free = {
  id: 'e1',
  status: EquipmentStatus.BON,
  archivedAt: null,
  attributions: [],
};

describe('EquipmentAttributionService.create', () => {
  let service: EquipmentAttributionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    equipmentRepo.findById.mockResolvedValue(free);
    tx.equipmentAttribution.count.mockResolvedValue(0);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentAttributionService,
        { provide: EquipmentAttributionRepository, useValue: {} },
        { provide: EquipmentRepository, useValue: equipmentRepo },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(EquipmentAttributionService);
  });

  it('attributes an available equipment (no quantity)', async () => {
    await service.create({ assetId: 'e1', beneficiaryId: 3 });
    expect(tx.equipmentAttribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ quantity: expect.anything() }),
      }),
    );
  });

  it('rejects an equipment already attributed', async () => {
    equipmentRepo.findById.mockResolvedValue({
      ...free,
      attributions: [{ status: 'ACTIVE' }],
    });
    await expect(
      service.create({ assetId: 'e1', beneficiaryId: 3 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a broken equipment', async () => {
    equipmentRepo.findById.mockResolvedValue({
      ...free,
      status: EquipmentStatus.EN_PANNE,
    });
    await expect(
      service.create({ assetId: 'e1', beneficiaryId: 3 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an archived equipment', async () => {
    equipmentRepo.findById.mockResolvedValue({
      ...free,
      archivedAt: new Date(),
    });
    await expect(
      service.create({ assetId: 'e1', beneficiaryId: 3 }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('EquipmentAttributionService.create — concurrence', () => {
  let service: EquipmentAttributionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    equipmentRepo.findById.mockResolvedValue(free);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentAttributionService,
        { provide: EquipmentAttributionRepository, useValue: {} },
        { provide: EquipmentRepository, useValue: equipmentRepo },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(EquipmentAttributionService);
  });

  it('re-checks inside a Serializable transaction and refuses if another ACTIVE attribution appeared', async () => {
    tx.equipmentAttribution.count.mockResolvedValue(1);
    await expect(
      service.create({ assetId: 'e1', beneficiaryId: 3 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(tx.equipmentAttribution.create).not.toHaveBeenCalled();
  });
});

describe('EquipmentAttributionService.findHolders', () => {
  it('queries active attributions with the search and groups them by holder', async () => {
    const repo = {
      findActiveForHolders: jest.fn().mockResolvedValue([
        {
          id: 'a1',
          attributedAt: new Date('2026-02-01'),
          beneficiary: { id: 1, name: 'Alice', email: 'a@x.mg', role: 'OM' },
          asset: { categoryId: 'c1' },
        },
      ]),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentAttributionService,
        { provide: EquipmentAttributionRepository, useValue: repo },
        { provide: EquipmentRepository, useValue: equipmentRepo },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get(EquipmentAttributionService);

    const holders = await service.findHolders({
      search: 'ali',
      categoryId: 'c1',
    });

    expect(repo.findActiveForHolders).toHaveBeenCalledWith('ali');
    expect(holders).toHaveLength(1);
    expect(holders[0]).toMatchObject({ user: { id: 1 }, equipmentCount: 1 });
  });
});
