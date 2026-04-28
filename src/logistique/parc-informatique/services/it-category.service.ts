import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItCategoryRepository } from 'src/repository/parc-informatique/it-category.repository';
import { CreateItCategoryDto } from '../dto/create-it-category.dto';
import { UpdateItCategoryDto } from '../dto/update-it-category.dto';

@Injectable()
export class ItCategoryService {
  constructor(private readonly repository: ItCategoryRepository) {}

  async create(dto: CreateItCategoryDto) {
    return this.repository.create({
      name: dto.name,
      description: dto.description,
      depreciationYears: dto.depreciationYears,
    });
  }

  async findAll(includeInactive = false) {
    return this.repository.findAll(includeInactive);
  }

  async update(id: string, dto: UpdateItCategoryDto) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('Catégorie introuvable.');
    }
    return this.repository.update(id, {
      name: dto.name,
      description: dto.description,
      depreciationYears: dto.depreciationYears,
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
