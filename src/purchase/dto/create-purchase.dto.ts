import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OperationType } from '@prisma/client';

export class AttachmentDto {
  @ApiProperty({
    description: 'Nom du fichier',
    example: 'devis-fournisseur.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    description: 'URL du fichier uploadé',
    example: 'https://storage.example.com/files/abc123.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @ApiProperty({
    description: 'ID du fichier dans la table File',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  fileId!: number;

  @ApiPropertyOptional({
    description: 'Taille du fichier en bytes',
    example: 1024000,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Type MIME du fichier',
    example: 'application/pdf',
  })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Description du fichier',
    example: 'Devis du fournisseur ABC',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreatePurchaseDto {
  @ApiProperty({
    description: "Type de l'operation",
    enum: OperationType,
    example: 'OPERATION',
  })
  @IsEnum(OperationType)
  @IsNotEmpty()
  operationType!: OperationType;

  @ApiProperty({
    description: 'Titre de la demande',
    example: 'Achat de materiel informatique',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    description: 'Description detaillee de la demande',
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
  justification!: string;

  @ApiProperty({
    description:
      "Code projet issu du tableau budgetaire actif (les champs d'imputation sont resolus cote serveur)",
    example: 'PROJ-2024-001',
  })
  @IsString()
  @IsNotEmpty()
  projectCode!: string;

  @ApiPropertyOptional({
    description:
      'Nom du projet (informatif, resolu cote serveur depuis le tableau budgetaire)',
  })
  @IsString()
  @IsOptional()
  projectName?: string;

  @ApiPropertyOptional({
    description:
      'Code subvention (informatif, resolu cote serveur depuis le tableau budgetaire)',
  })
  @IsString()
  @IsOptional()
  grantCode?: string;

  @ApiPropertyOptional({
    description:
      'Code activite (informatif, resolu cote serveur depuis le tableau budgetaire)',
  })
  @IsString()
  @IsOptional()
  activityCode?: string;

  @ApiPropertyOptional({
    description:
      'Centre de cout (informatif, resolu cote serveur depuis le tableau budgetaire)',
  })
  @IsString()
  @IsOptional()
  costCenter?: string;

  @ApiPropertyOptional({ description: 'Region (saisie manuelle)' })
  @IsString()
  @IsOptional()
  region?: string;

  @ApiPropertyOptional({ description: 'Site (saisie manuelle)' })
  @IsString()
  @IsOptional()
  site?: string;

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

  @ApiPropertyOptional({
    description: 'Pièces jointes de la demande',
    type: [AttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
