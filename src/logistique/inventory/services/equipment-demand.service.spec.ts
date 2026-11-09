import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EquipmentDemandService } from './equipment-demand.service';
import { EquipmentDemandRepository } from 'src/repository/inventory/equipment-demand.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';

const repository = {
  generateReference: jest.fn(),
  create: jest.fn(),
  countFilesUploadedBy: jest.fn(),
};

const dto = {
  desiredType: 'Laptop',
  quantity: 1,
  justification: 'Nouvel arrivant',
};

describe('EquipmentDemandService.create', () => {
  let service: EquipmentDemandService;

  beforeEach(async () => {
    jest.clearAllMocks();
    repository.generateReference.mockResolvedValue('IT-2026-0001');
    repository.create.mockResolvedValue({ id: 'd1' });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentDemandService,
        { provide: EquipmentDemandRepository, useValue: repository },
        { provide: NotificationService, useValue: {} },
      ],
    }).compile();
    service = module.get(EquipmentDemandService);
  });

  it('links the uploaded documents to the demand', async () => {
    repository.countFilesUploadedBy.mockResolvedValue(2);

    await service.create({ ...dto, fileIds: [10, 11] }, 7);

    expect(repository.countFilesUploadedBy).toHaveBeenCalledWith([10, 11], 7);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ requestorId: 7, fileIds: [10, 11] }),
    );
  });

  it('rejects files the requester did not upload', async () => {
    repository.countFilesUploadedBy.mockResolvedValue(1);

    await expect(
      service.create({ ...dto, fileIds: [10, 99] }, 7),
    ).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('creates a demand without documents', async () => {
    await service.create(dto, 7);

    expect(repository.countFilesUploadedBy).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ fileIds: [] }),
    );
  });
});
