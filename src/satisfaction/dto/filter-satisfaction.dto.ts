import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { OperationType } from '@prisma/client';

export class FilterSatisfactionDto {
  @ApiPropertyOptional({ description: 'Date de début (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Date de fin (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'ID du fournisseur retenu' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Type de marché' })
  @IsOptional()
  @IsString()
  marketType?: string;

  @ApiPropertyOptional({ enum: OperationType, description: "Type d'opération" })
  @IsOptional()
  @IsEnum(OperationType)
  operationType?: OperationType;

  @ApiPropertyOptional({ description: "ID du dossier d'achat (usage futur)" })
  @IsOptional()
  @IsString()
  purchaseId?: string;
}
