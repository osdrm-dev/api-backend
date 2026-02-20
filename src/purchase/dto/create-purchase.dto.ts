import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OperationType } from '@prisma/client';

export class CreatePurchaseDto {
  @ApiProperty({
    description: "Type de l'operation",
    enum: OperationType,
    example: 'OPERATION',
  })
  @IsEnum(OperationType)
  @IsNotEmpty()
  operationType: OperationType;

  @ApiProperty({
    description: 'Montant estime en MGA',
    example: 10000000,
    minimum: 0,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Titre de la demande',
    example: 'Achat de materiel informatique',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Description detaillee de la demande',
    example: 'Ordinateurs portables pour le service IT',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Justification de la demande',
    example: 'Renouvellement du parc informatique',
  })
  @IsString()
  @IsNotEmpty()
  justification: string;

  @ApiPropertyOptional({
    description: 'Code projet',
    example: 'PROJ-2024-001',
  })
  @IsString()
  @IsOptional()
  project?: string;

  @ApiPropertyOptional({
    description: 'Region',
    example: 'Analamanga',
  })
  @IsString()
  @IsOptional()
  region?: string;

  @ApiPropertyOptional({
    description: 'Site',
    example: 'Antananarivo',
  })
  @IsString()
  @IsOptional()
  site?: string;

  @ApiPropertyOptional({
    description: 'Code projet comptable',
    example: 'PC-001',
  })
  @IsString()
  @IsOptional()
  projectCode?: string;

  @ApiPropertyOptional({
    description: 'Code subvention',
    example: 'GRANT-2024',
  })
  @IsString()
  @IsOptional()
  grantCode?: string;

  @ApiPropertyOptional({
    description: 'Code activite',
    example: 'ACT-IT',
  })
  @IsString()
  @IsOptional()
  activityCode?: string;

  @ApiPropertyOptional({
    description: 'Centre de cout',
    example: 'CC-IT',
  })
  @IsString()
  @IsOptional()
  costCenter?: string;

  @ApiPropertyOptional({
    description: 'Type de marche',
    example: 'Fournitures',
  })
  @IsString()
  @IsOptional()
  marketType?: string;

  @ApiPropertyOptional({
    description: 'Adresse de livraison',
    example: 'Bureau central - Antananarivo',
  })
  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @ApiPropertyOptional({
    description: 'Date de livraison souhaitee',
    example: '2024-03-01T00:00:00.000Z',
  })
  @IsOptional()
  requestedDeliveryDate?: Date;

  @ApiPropertyOptional({
    description: 'Priorite',
    example: 'NORMAL',
  })
  @IsString()
  @IsOptional()
  priority?: string;
}
