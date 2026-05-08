import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItAssetRepository } from 'src/repository/parc-informatique/it-asset.repository';
import { ItCategoryRepository } from 'src/repository/parc-informatique/it-category.repository';
import { CreateItAssetDto } from '../dto/create-it-asset.dto';
import { UpdateItAssetDto } from '../dto/update-it-asset.dto';
import { FilterItAssetDto } from '../dto/filter-it-asset.dto';

@Injectable()
export class ItAssetService {
  constructor(
    private readonly repository: ItAssetRepository,
    private readonly categoryRepository: ItCategoryRepository,
  ) {}

  private enrichWithStock(asset: any) {
    return {
      ...asset,
      stockDisponible: asset.quantiteTotal - asset.quantiteAttribuee,
    };
  }

  async create(dto: CreateItAssetDto) {
    const category = await this.categoryRepository.findById(dto.categoryId);
    if (!category) {
      throw new NotFoundException('Catégorie introuvable.');
    }
    const asset = await this.repository.create({
      categoryId: dto.categoryId,
      designation: dto.designation,
      serialNumber: dto.serialNumber,
      supplierReference: dto.supplierReference,
      status: dto.status,
      location: dto.location,
      acquisitionDate: new Date(dto.acquisitionDate),
      purchasePrice: dto.purchasePrice,
      quantiteTotal: dto.quantiteTotal,
      seuilAlerte: dto.seuilAlerte,
      depreciationOverrideYears: dto.depreciationOverrideYears,
    });
    return this.enrichWithStock(asset);
  }

  async findAll(query: FilterItAssetDto) {
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
      data: data.map((a) => this.enrichWithStock(a)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    const asset = await this.repository.findById(id);
    if (!asset || asset.archivedAt !== null) {
      throw new NotFoundException('Actif informatique introuvable.');
    }
    return this.enrichWithStock(asset);
  }

  async update(id: string, dto: UpdateItAssetDto) {
    const existing = await this.repository.findById(id);
    if (!existing || existing.archivedAt !== null) {
      throw new NotFoundException('Actif informatique introuvable.');
    }
    if (dto.categoryId) {
      const category = await this.categoryRepository.findById(dto.categoryId);
      if (!category) {
        throw new NotFoundException('Catégorie introuvable.');
      }
    }
    const asset = await this.repository.update(id, {
      categoryId: dto.categoryId,
      designation: dto.designation,
      serialNumber: dto.serialNumber,
      supplierReference: dto.supplierReference,
      status: dto.status,
      location: dto.location,
      acquisitionDate: dto.acquisitionDate
        ? new Date(dto.acquisitionDate)
        : undefined,
      purchasePrice: dto.purchasePrice,
      quantiteTotal: dto.quantiteTotal,
      seuilAlerte: dto.seuilAlerte,
      depreciationOverrideYears: dto.depreciationOverrideYears,
    });
    return this.enrichWithStock(asset);
  }

  async archive(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing || existing.archivedAt !== null) {
      throw new NotFoundException('Actif informatique introuvable.');
    }
    const activeAttributions = existing.attributions?.length ?? 0;
    if (activeAttributions > 0) {
      throw new BadRequestException(
        "Impossible d'archiver un actif avec des attributions actives.",
      );
    }
    const asset = await this.repository.archive(id);
    return this.enrichWithStock(asset);
  }
}
