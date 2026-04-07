import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { OperationType } from '@prisma/client';

export class UpdatePurchaseDto {
  @ApiPropertyOptional({
    description: "Type de l'operation",
    enum: OperationType,
    example: 'OPERATION',
  })
  @IsEnum(OperationType)
  @IsOptional()
  operationType?: OperationType;

  @ApiPropertyOptional({
    description: 'Titre de la demande',
    example: 'Achat de materiel informatique',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Description detaillee de la demande',
    example: 'Ordinateurs portables pour le service IT',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Justification de la demande',
    example: 'Renouvellement du parc informatique',
  })
  @IsString()
  @IsOptional()
  justification?: string;

  @ApiPropertyOptional({
    description:
      'Code projet issu du tableau budgetaire actif (optionnel a la mise a jour)',
    example: 'PROJ-2024-001',
  })
  @IsString()
  @IsOptional()
  projectCode?: string;

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
    description: 'Observations',
    example: 'Remarques supplementaires',
  })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiPropertyOptional({
    description: 'Priorite',
    example: 'NORMAL',
  })
  @IsString()
  @IsOptional()
  priority?: string;
}
