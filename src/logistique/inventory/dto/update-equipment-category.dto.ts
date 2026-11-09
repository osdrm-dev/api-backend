import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateEquipmentCategoryDto } from './create-equipment-category.dto';

export class UpdateEquipmentCategoryDto extends PartialType(
  CreateEquipmentCategoryDto,
) {
  @ApiPropertyOptional({ description: 'Activer / désactiver la catégorie' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
