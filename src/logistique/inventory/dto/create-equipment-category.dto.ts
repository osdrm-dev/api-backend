import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateEquipmentCategoryDto {
  @ApiProperty({
    description: 'Nom de la catégorie',
    example: 'Ordinateurs portables',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Description de la catégorie' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Durée de vie (amortissement) en années',
    default: 3,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  depreciationYears?: number;

  @ApiPropertyOptional({
    description:
      "Seuil d'alerte : alerte si le nombre de matériels disponibles de la catégorie est inférieur",
    default: 1,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  alertThreshold?: number;
}
