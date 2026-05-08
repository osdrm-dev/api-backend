import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ItAssetStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateItAssetDto {
  @ApiProperty({ description: 'ID de la catégorie' })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({
    description: "Désignation de l'actif",
    example: 'Laptop Dell XPS 15',
  })
  @IsString()
  @IsNotEmpty()
  designation!: string;

  @ApiPropertyOptional({ description: 'Numéro de série' })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ description: 'Référence fournisseur' })
  @IsString()
  @IsOptional()
  supplierReference?: string;

  @ApiPropertyOptional({ enum: ItAssetStatus, default: ItAssetStatus.NEUF })
  @IsEnum(ItAssetStatus)
  @IsOptional()
  status?: ItAssetStatus;

  @ApiPropertyOptional({ description: 'Localisation' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: "Date d'acquisition", example: '2024-01-15' })
  @IsDateString()
  acquisitionDate!: string;

  @ApiProperty({ description: "Prix d'achat", example: 1500.0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  purchasePrice!: number;

  @ApiPropertyOptional({ description: 'Quantité totale', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  quantiteTotal?: number;

  @ApiPropertyOptional({ description: "Seuil d'alerte stock", default: 1 })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  seuilAlerte?: number;

  @ApiPropertyOptional({
    description: "Durée de vie d'amortissement personnalisée (en années)",
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  depreciationOverrideYears?: number;
}
