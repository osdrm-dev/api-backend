import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EquipmentCategoryRepository } from 'src/repository/inventory/equipment-category.repository';
import { CreateEquipmentCategoryDto } from '../dto/create-equipment-category.dto';
import { UpdateEquipmentCategoryDto } from '../dto/update-equipment-category.dto';

@Injectable()
export class EquipmentCategoryService {
  constructor(private readonly repository: EquipmentCategoryRepository) {}

  async create(dto: CreateEquipmentCategoryDto) {
    return this.repository.create({
      name: dto.name,
      description: dto.description,
      depreciationYears: dto.depreciationYears,
      alertThreshold: dto.alertThreshold,
    });
  }

  async findAll(includeInactive = false) {
    return this.repository.findAll(includeInactive);
  }

  async update(id: string, dto: UpdateEquipmentCategoryDto) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('Catégorie introuvable.');
    }
    return this.repository.update(id, {
      name: dto.name,
      description: dto.description,
      depreciationYears: dto.depreciationYears,
      alertThreshold: dto.alertThreshold,
      isActive: dto.isActive,
    });
  }

  async delete(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('Catégorie introuvable.');
    }
    const hasAssets = await this.repository.hasActiveAssets(id);
    if (hasAssets) {
      throw new BadRequestException(
        'Impossible de supprimer une catégorie qui possède des actifs actifs.',
      );
    }
    return this.repository.delete(id);
  }
}
