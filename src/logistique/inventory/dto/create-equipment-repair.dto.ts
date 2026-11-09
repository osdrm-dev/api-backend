import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { MaintenanceUrgencyLevel } from '@prisma/client';

export class CreateEquipmentRepairDto {
  @ApiProperty({ description: 'ID du matériel en panne' })
  @IsString()
  @IsNotEmpty()
  equipmentId!: string;

  @ApiProperty({ description: 'Description de la panne' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    enum: MaintenanceUrgencyLevel,
    default: MaintenanceUrgencyLevel.NORMALE,
  })
  @IsEnum(MaintenanceUrgencyLevel)
  @IsOptional()
  urgencyLevel?: MaintenanceUrgencyLevel;

  @ApiPropertyOptional({
    description: 'Titre (par défaut : « Panne — désignation (référence) »)',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description:
      'IDs des documents/photos joints, téléversés via POST /files/upload (max 5)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  fileIds?: number[];
}
