import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidatePurchaseDto {
  @ApiPropertyOptional({
    description: 'Commentaire de validation',
    example: 'Budget approuve. Valide pour passage a QR.',
  })
  @IsString()
  @IsOptional()
  comment?: string;
}

export class RejectPurchaseDto {
  @ApiProperty({
    description: 'Motif du rejet (obligatoire)',
    example: 'Budget insuffisant pour ce projet.',
  })
  @IsString()
  comment: string;
}

export class RequestChangesDto {
  @ApiProperty({
    description: 'Raison de la demande de modification',
    example: 'Veuillez preciser les specifications techniques des equipements.',
  })
  @IsString()
  reason: string;
}

export class FilterPurchaseDto {
  @ApiPropertyOptional({
    description: 'Numero de page',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Nombre d'elements par page",
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Champ de tri',
    example: 'createdAt',
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Ordre de tri',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Filtrer par statut',
    example: 'PUBLISHED',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par projet',
    example: 'PROJ-2024-001',
  })
  @IsString()
  @IsOptional()
  project?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par region',
    example: 'Analamanga',
  })
  @IsString()
  @IsOptional()
  region?: string;

  @ApiPropertyOptional({
    description: 'Recherche textuelle',
    example: 'materiel informatique',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
