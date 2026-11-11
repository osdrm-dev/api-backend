import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EquipmentRepository } from 'src/repository/inventory/equipment.repository';
import { EquipmentCategoryRepository } from 'src/repository/inventory/equipment-category.repository';
import {
  CreateEquipmentDto,
  UpdateEquipmentDto,
} from '../dto/create-equipment.dto';
import { FilterEquipmentDto } from '../dto/filter-equipment.dto';
import { isEquipmentAvailable } from '../utils/equipment-stock.util';

const UNIQUE_FIELD_LABELS: Record<string, string> = {
  inventoryReference: 'référence inventaire',
  serialNumber: 'numéro de série',
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
        const field = target.find((t) => UNIQUE_FIELD_LABELS[t]);
        throw new ConflictException(
          `Cette ${field ? UNIQUE_FIELD_LABELS[field] : 'valeur'} est déjà utilisée par un autre matériel.`,
        );
      }
      throw e;
    }
  }

  async create(dto: CreateEquipmentDto) {
    const category = await this.categoryRepository.findById(dto.categoryId);
    if (!category) {
      throw new NotFoundException('Catégorie introuvable.');
    }

    const dupRef = findDuplicate(dto.units.map((u) => u.inventoryReference));
    if (dupRef) {
      throw new BadRequestException(
        `Référence inventaire en double dans la saisie : ${dupRef}.`,
      );
    }
    const dupSerial = findDuplicate(dto.units.map((u) => u.serialNumber));
    if (dupSerial) {
      throw new BadRequestException(
        `Numéro de série en double dans la saisie : ${dupSerial}.`,
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
      throw new NotFoundException('Matériel introuvable.');
    }
    return this.withAvailability(equipment);
  }

  async update(id: string, dto: UpdateEquipmentDto) {
    const existing = await this.repository.findById(id);
    if (!existing || existing.archivedAt !== null) {
      throw new NotFoundException('Matériel introuvable.');
    }
    if (dto.categoryId) {
      const category = await this.categoryRepository.findById(dto.categoryId);
      if (!category) {
        throw new NotFoundException('Catégorie introuvable.');
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
      throw new NotFoundException('Matériel introuvable.');
    }
    if ((existing.attributions?.length ?? 0) > 0) {
      throw new BadRequestException(
        "Impossible d'archiver un matériel attribué.",
      );
    }
    const equipment = await this.repository.archive(id);
    return this.withAvailability(equipment);
  }
}
