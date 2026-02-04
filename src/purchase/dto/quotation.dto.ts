import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UploadQuoteDto {
  @ApiProperty({
    description: 'Nom du fichier',
    example: 'devis-fournisseur-A.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({
    description: 'URL du fichier',
    example: 'https://storage.example.com/quotes/devis-001.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiPropertyOptional({
    description: 'Taille du fichier en octets',
    example: 1024000,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Type MIME du fichier',
    example: 'application/pdf',
  })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Description du devis',
    example: 'Devis du fournisseur A pour materiel informatique',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Nom du fournisseur',
    example: 'Fournisseur A',
  })
  @IsString()
  @IsOptional()
  uploadedBy?: string;
}

export class QuoteRequirementDto {
  @ApiProperty({
    description: 'Demander une derogation pour devis insuffisants',
    example: false,
  })
  @IsBoolean()
  requestDerogation: boolean;

  @ApiPropertyOptional({
    description: 'Raison de la derogation si demandee',
    example: 'Seulement 2 fournisseurs disponibles dans la region',
  })
  @IsString()
  @IsOptional()
  derogationReason?: string;
}

export class QuoteLevelInfo {
  level: number;
  label: string;
  requiredQuotes: number;
  description: string;
}
