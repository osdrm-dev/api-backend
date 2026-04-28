import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  MaintenanceInterventionType,
  MaintenanceUrgencyLevel,
} from '@prisma/client';

export class CreateMaintenanceRequestDto {
  @ApiProperty({
    description: "Type d'intervention",
    enum: MaintenanceInterventionType,
    example: MaintenanceInterventionType.REPARATION,
  })
  @IsEnum(MaintenanceInterventionType)
  @IsNotEmpty()
  interventionType!: MaintenanceInterventionType;

  @ApiPropertyOptional({
    description: "Niveau d'urgence",
    enum: MaintenanceUrgencyLevel,
    default: MaintenanceUrgencyLevel.NORMALE,
  })
  @IsEnum(MaintenanceUrgencyLevel)
  @IsOptional()
  urgencyLevel?: MaintenanceUrgencyLevel;

  @ApiProperty({
    description: 'Titre de la demande',
    example: 'Réparation moteur véhicule AB-123-CD',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Description détaillée de la demande',
    example: 'Le moteur émet des bruits anormaux lors du démarrage.',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    description: 'Localisation / lieu de la maintenance',
    example: 'Garage central - Antananarivo',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({
    description:
      'Référence du véhicule concerné (immatriculation ou ID parc auto)',
    example: 'AB-123-CD',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  vehicleRef?: string;
}
