import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { VehicleStatut } from '@prisma/client';

export class ListVehiclesQueryDto {
  @ApiPropertyOptional({
    description: 'Numéro de page',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Nombre d'éléments par page",
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filtrer par statut',
    enum: VehicleStatut,
  })
  @IsOptional()
  @IsEnum(VehicleStatut)
  statut?: VehicleStatut;

  @ApiPropertyOptional({
    description: 'Filtrer par marque (exact)',
    example: 'Toyota',
  })
  @IsOptional()
  @IsString()
  marque?: string;

  @ApiPropertyOptional({
    description: 'Recherche sur immatriculation, marque, modèle',
    example: 'Hilux',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Inclure les véhicules archivés',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeArchived?: boolean = false;
}
