import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { VehicleDocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'Type de document',
    enum: VehicleDocumentType,
    example: VehicleDocumentType.ASSURANCE,
  })
  @IsEnum(VehicleDocumentType)
  type: VehicleDocumentType;

  @ApiPropertyOptional({
    description:
      'Référence du document (numéro de police, n° carte grise, etc.)',
    example: 'POL-2024-001',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Date de début de validité (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @ApiProperty({
    description: "Date d'expiration (ISO 8601)",
    example: '2026-12-31',
  })
  @IsDateString()
  @IsNotEmpty()
  dateExpiration: string;
}
