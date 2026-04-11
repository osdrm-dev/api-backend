import { IsOptional, IsString, IsIn, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class KpiQueryDto {
  @ApiPropertyOptional({
    description: 'Date de début (ISO 8601). Défaut : 12 mois en arrière.',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: "Date de fin (ISO 8601). Défaut : aujourd'hui.",
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Filtre sur la région (valeur exacte)' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    enum: ['marketType', 'operationType'],
    default: 'marketType',
    description: 'Axe de regroupement pour le KPI 2 — délai acheteur',
  })
  @IsOptional()
  @IsIn(['marketType', 'operationType'])
  buyerDelayGroupBy?: 'marketType' | 'operationType';

  @ApiPropertyOptional({
    description:
      'ID fournisseur pour filtrer le KPI 5 (évaluation fournisseur)',
  })
  @IsOptional()
  @IsString()
  supplierId?: string;
}
