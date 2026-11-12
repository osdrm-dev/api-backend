import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment category not found',
      );
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment category not found',
      );
    }
    const hasAssets = await this.repository.hasActiveAssets(id);
    if (hasAssets) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.EQUIPMENT_CATEGORY_HAS_ASSETS,
        'Cannot delete a category that has active assets',
      );
    }
    return this.repository.delete(id);
  }
}
