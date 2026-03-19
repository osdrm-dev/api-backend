import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseStep } from '@prisma/client';

export class PaginationDto {
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
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class FilterPurchaseDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Recherche par référence ou titre',
    example: 'DA-2024-0001',
  })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par statut',
    example: 'PUBLISHED',
  })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par étape actuelle',
    example: 'DA',
    enum: PurchaseStep,
  })
  @IsOptional()
  @IsEnum(PurchaseStep)
  currentStep?: PurchaseStep;

  @ApiPropertyOptional({
    description: 'Filtrer par priorité',
    example: 'HIGH',
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({
    description: 'Date de début',
    example: '2024-01-01',
  })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Date de fin',
    example: '2024-12-31',
  })
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Montant minimum',
    example: 1000000,
  })
  @IsOptional()
  @Type(() => Number)
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Montant maximum',
    example: 10000000,
  })
  @IsOptional()
  @Type(() => Number)
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Grouper les résultats par étape (currentStep)',
    example: false,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  groupByStep?: boolean = false;
}
