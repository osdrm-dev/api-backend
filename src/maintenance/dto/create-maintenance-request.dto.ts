import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MaintenanceInterventionType,
  MaintenanceUrgencyLevel,
} from '@prisma/client';

export class MaintenanceRequestDataDto {
  @ApiPropertyOptional({
    description:
      'IDs des pièces jointes, téléversées au préalable via POST /files/upload (max 5)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  attachmentIds?: number[];
}

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
    example: 'clx12345abcde',
    description: 'ID du véhicule concerné',
  })
  @IsString()
  @IsOptional()
  vehicleId?: string;

  @ApiPropertyOptional({
    example: 'AB-123-CD',
    description: 'Immatriculation du véhicule (alternatif à vehicleId)',
  })
  @IsString()
  @IsOptional()
  immatriculation?: string;

  @ApiPropertyOptional({ type: MaintenanceRequestDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MaintenanceRequestDataDto)
  data?: MaintenanceRequestDataDto;
}
