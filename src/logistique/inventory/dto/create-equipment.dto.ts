import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { EquipmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';

/** Champs propres à chaque unité physique. */
export class EquipmentUnitDto {
  @ApiProperty({
    description: 'Référence inventaire interne',
    example: 'INV-0001',
  })
  @IsString()
  @IsNotEmpty()
  inventoryReference!: string;

  @ApiPropertyOptional({ description: 'Numéro de série' })
  @IsString()
  @IsOptional()
  serialNumber?: string;
}

/** Champs communs à toutes les unités d'un même lot. */
export class EquipmentCommonDto {
  @ApiProperty({ description: 'ID de la catégorie' })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({ description: 'Désignation', example: 'Smartphone' })
  @IsString()
  @IsNotEmpty()
  designation!: string;

  @ApiPropertyOptional({ description: 'Marque', example: 'Apple' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ description: 'Modèle', example: 'iPhone 17' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ description: 'Référence fournisseur' })
  @IsString()
  @IsOptional()
  supplierReference?: string;

  @ApiPropertyOptional({
    enum: EquipmentStatus,
    default: EquipmentStatus.NEUF,
  })
  @IsEnum(EquipmentStatus)
  @IsOptional()
  status?: EquipmentStatus;

  @ApiPropertyOptional({ description: 'Localisation' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: "Date d'acquisition", example: '2024-01-15' })
  @IsDateString()
  acquisitionDate!: string;

  @ApiProperty({ description: "Prix d'achat unitaire", example: 1500.0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  purchasePrice!: number;

  @ApiPropertyOptional({
    description: "Durée de vie d'amortissement personnalisée (en années)",
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  depreciationOverrideYears?: number;
}

export class CreateEquipmentDto extends EquipmentCommonDto {
  @ApiProperty({
    type: [EquipmentUnitDto],
    description: "Une entrée par unité physique (quantité = nombre d'entrées)",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => EquipmentUnitDto)
  units!: EquipmentUnitDto[];
}

export class UpdateEquipmentDto extends PartialType(EquipmentCommonDto) {
  @ApiPropertyOptional({ description: 'Référence inventaire interne' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  inventoryReference?: string;

  @ApiPropertyOptional({ description: 'Numéro de série' })
  @IsString()
  @IsOptional()
  serialNumber?: string;
}
