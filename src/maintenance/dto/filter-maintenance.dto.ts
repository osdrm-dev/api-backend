import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  MaintenanceInterventionType,
  MaintenanceStatus,
  MaintenanceUrgencyLevel,
} from '@prisma/client';

export class FilterMaintenanceDto {
  @ApiPropertyOptional({
    description: 'Filtrer par statut',
    enum: MaintenanceStatus,
  })
  @IsEnum(MaintenanceStatus)
  @IsOptional()
  status?: MaintenanceStatus;

  @ApiPropertyOptional({
    description: "Filtrer par niveau d'urgence",
    enum: MaintenanceUrgencyLevel,
  })
  @IsEnum(MaintenanceUrgencyLevel)
  @IsOptional()
  urgencyLevel?: MaintenanceUrgencyLevel;

  @ApiPropertyOptional({
    description: "Filtrer par type d'intervention",
    enum: MaintenanceInterventionType,
  })
  @IsEnum(MaintenanceInterventionType)
  @IsOptional()
  interventionType?: MaintenanceInterventionType;

  @ApiPropertyOptional({ description: 'Filtrer par référence véhicule' })
  @IsString()
  @IsOptional()
  vehicleRef?: string;

  @ApiPropertyOptional({
    description: 'Recherche textuelle (titre, description, référence)',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Date de début (ISO 8601)' })
  @IsOptional()
  @Type(() => Date)
  dateFrom?: Date;

  @ApiPropertyOptional({ description: 'Date de fin (ISO 8601)' })
  @IsOptional()
  @Type(() => Date)
  dateTo?: Date;

  @ApiPropertyOptional({
    description: 'Numéro de page',
    default: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Nombre de résultats par page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
