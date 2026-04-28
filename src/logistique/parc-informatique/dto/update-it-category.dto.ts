import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateItCategoryDto } from './create-it-category.dto';

export class UpdateItCategoryDto extends PartialType(CreateItCategoryDto) {
  @ApiPropertyOptional({ description: 'Activer / désactiver la catégorie' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
