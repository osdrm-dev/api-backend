import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { EquipmentRepository } from 'src/repository/inventory/equipment.repository';
import { EquipmentCategoryRepository } from 'src/repository/inventory/equipment-category.repository';
import {
  CreateEquipmentDto,
  UpdateEquipmentDto,
} from '../dto/create-equipment.dto';
import { FilterEquipmentDto } from '../dto/filter-equipment.dto';
import { isEquipmentAvailable } from '../utils/equipment-stock.util';

const UNIQUE_FIELD_CODES: Record<string, ErrorCode> = {
  inventoryReference: ErrorCode.EQUIPMENT_INVENTORY_REFERENCE_ALREADY_EXISTS,
  serialNumber: ErrorCode.EQUIPMENT_SERIAL_NUMBER_ALREADY_EXISTS,
};

function findDuplicate(values: (string | undefined)[]) {
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return null;
}

@Injectable()
export class EquipmentService {
  constructor(
    private readonly repository: EquipmentRepository,
    private readonly categoryRepository: EquipmentCategoryRepository,
  ) {}

  private withAvailability(equipment: any) {
    return { ...equipment, isAvailable: isEquipmentAvailable(equipment) };
  }

  /** Transforme une violation d'unicité Prisma (P2002) en 409 lisible. */
  private async guardUnique<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const target: string[] = e.meta?.target ?? [];
        const field = target.find((t) => UNIQUE_FIELD_CODES[t]);
        throw new AppException(
          HttpStatus.CONFLICT,
          field
            ? UNIQUE_FIELD_CODES[field]
            : ErrorCode.EQUIPMENT_VALUE_ALREADY_EXISTS,
          'Equipment unique value already in use',
        );
      }
      throw e;
    }
  }

  async create(dto: CreateEquipmentDto) {
    const category = await this.categoryRepository.findById(dto.categoryId);
    if (!category) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment category not found',
      );
    }

    const dupRef = findDuplicate(dto.units.map((u) => u.inventoryReference));
    if (dupRef) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.EQUIPMENT_DUPLICATE_INVENTORY_REFERENCE,
        `Duplicate inventory reference in input: ${dupRef}`,
        { params: { value: dupRef } },
      );
    }
    const dupSerial = findDuplicate(dto.units.map((u) => u.serialNumber));
    if (dupSerial) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.EQUIPMENT_DUPLICATE_SERIAL_NUMBER,
        `Duplicate serial number in input: ${dupSerial}`,
        { params: { value: dupSerial } },
      );
    }

    const { units, acquisitionDate, ...common } = dto;
    const rows = units.map((u) => ({
      ...common,
      acquisitionDate: new Date(acquisitionDate),
      inventoryReference: u.inventoryReference,
      serialNumber: u.serialNumber || undefined,
    }));

    const created = await this.guardUnique(() =>
      this.repository.createMany(rows),
    );
    return created.map((e) => this.withAvailability(e));
  }

  async findAll(query: FilterEquipmentDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { data, total } = await this.repository.findAll(
      {
        categoryId: query.categoryId,
        status: query.status,
        location: query.location,
        search: query.search,
      },
      { skip, take: limit },
    );

    return {
      data: data.map((a) => this.withAvailability(a)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    const equipment = await this.repository.findById(id);
    if (!equipment || equipment.archivedAt !== null) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment not found',
      );
    }
    return this.withAvailability(equipment);
  }

  async update(id: string, dto: UpdateEquipmentDto) {
    const existing = await this.repository.findById(id);
    if (!existing || existing.archivedAt !== null) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment not found',
      );
    }
    if (dto.categoryId) {
      const category = await this.categoryRepository.findById(dto.categoryId);
      if (!category) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          'Equipment category not found',
        );
      }
    }
    const { acquisitionDate, ...rest } = dto;
    const equipment = await this.guardUnique(() =>
      this.repository.update(id, {
        ...rest,
        acquisitionDate: acquisitionDate
          ? new Date(acquisitionDate)
          : undefined,
      }),
    );
    return this.withAvailability(equipment);
  }

  async archive(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing || existing.archivedAt !== null) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment not found',
      );
    }
    if ((existing.attributions?.length ?? 0) > 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.EQUIPMENT_ARCHIVE_ATTRIBUTED,
        'Cannot archive an attributed equipment',
      );
    }
    const equipment = await this.repository.archive(id);
    return this.withAvailability(equipment);
  }
}
