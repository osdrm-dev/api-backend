import { Test, TestingModule } from '@nestjs/testing';
import { EquipmentService } from './equipment.service';
import { EquipmentRepository } from 'src/repository/inventory/equipment.repository';
import { EquipmentCategoryRepository } from 'src/repository/inventory/equipment-category.repository';
import { ErrorCode } from 'src/common/errors';

const repo = { createMany: jest.fn() };
const categoryRepo = { findById: jest.fn() };

const base = {
  categoryId: 'c1',
  designation: 'Smartphone',
  brand: 'Apple',
  model: 'iPhone 17',
  acquisitionDate: '2026-10-01',
  purchasePrice: 1000,
};

describe('EquipmentService.create (bulk)', () => {
  let service: EquipmentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    categoryRepo.findById.mockResolvedValue({ id: 'c1' });
    repo.createMany.mockImplementation((rows) =>
      rows.map((r, i) => ({ id: `e${i}`, ...r, attributions: [] })),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentService,
        { provide: EquipmentRepository, useValue: repo },
        { provide: EquipmentCategoryRepository, useValue: categoryRepo },
      ],
    }).compile();
    service = module.get(EquipmentService);
  });

  it('creates one equipment per unit sharing common fields', async () => {
    const result = await service.create({
      ...base,
      units: [
        { inventoryReference: 'INV-1', serialNumber: 'SN1' },
        { inventoryReference: 'INV-2' },
      ],
    });
    expect(repo.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        categoryId: 'c1',
        brand: 'Apple',
        model: 'iPhone 17',
        inventoryReference: 'INV-1',
        serialNumber: 'SN1',
        acquisitionDate: new Date('2026-10-01'),
      }),
      expect.objectContaining({ inventoryReference: 'INV-2' }),
    ]);
    expect(result).toHaveLength(2);
  });

  it('rejects duplicate inventory references inside the payload', async () => {
    await expect(
      service.create({
        ...base,
        units: [
          { inventoryReference: 'INV-1' },
          { inventoryReference: 'INV-1' },
        ],
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.EQUIPMENT_DUPLICATE_INVENTORY_REFERENCE,
    });
    expect(repo.createMany).not.toHaveBeenCalled();
  });

  it('rejects duplicate serial numbers inside the payload', async () => {
    await expect(
      service.create({
        ...base,
        units: [
          { inventoryReference: 'INV-1', serialNumber: 'SN' },
          { inventoryReference: 'INV-2', serialNumber: 'SN' },
        ],
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.EQUIPMENT_DUPLICATE_SERIAL_NUMBER,
    });
  });

  it('maps a unique violation from the database to 409', async () => {
    repo.createMany.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['inventoryReference'] },
    });
    await expect(
      service.create({ ...base, units: [{ inventoryReference: 'INV-1' }] }),
    ).rejects.toMatchObject({
      code: ErrorCode.EQUIPMENT_INVENTORY_REFERENCE_ALREADY_EXISTS,
    });
  });

  it('rejects unknown category', async () => {
    categoryRepo.findById.mockResolvedValue(null);
    await expect(
      service.create({ ...base, units: [{ inventoryReference: 'INV-1' }] }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});
