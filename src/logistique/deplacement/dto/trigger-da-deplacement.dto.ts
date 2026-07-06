import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class TriggerDaDeplacementDto {
  @ApiProperty({
    description: 'Code activite issu du tableau budgétaire actif',
    example: 'ACT-2024-001',
  })
  @IsString()
  @IsNotEmpty()
  activityCode: string;

  @ApiProperty({
    description: "ID de l'acheteur responsable de la DA générée",
    example: 5,
  })
  @IsInt()
  @IsNotEmpty()
  acheteurId: number;

  @ApiPropertyOptional({ description: 'Titre de la DA', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Description de la DA' })
  @IsOptional()
  @IsString()
  description?: string;
}
