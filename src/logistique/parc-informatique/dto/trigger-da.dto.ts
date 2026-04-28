import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class TriggerDaDto {
  @ApiProperty({
    description: 'Code projet issu du tableau budgétaire actif',
    example: 'PROJ-2024-001',
  })
  @IsString()
  @IsNotEmpty()
  projectCode!: string;

  @ApiProperty({
    description: "ID de l'acheteur responsable de la DA générée",
    example: 5,
  })
  @IsInt()
  @IsNotEmpty()
  acheteurId!: number;

  @ApiPropertyOptional({
    description: 'Titre de la DA',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Description de la DA' })
  @IsString()
  @IsOptional()
  description?: string;
}
