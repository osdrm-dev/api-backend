import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEquipmentAttributionDto {
  @ApiProperty({ description: "ID de l'actif à attribuer" })
  @IsString()
  @IsNotEmpty()
  assetId!: string;

  @ApiProperty({ description: 'ID du bénéficiaire', example: 3 })
  @IsInt()
  @Type(() => Number)
  beneficiaryId!: number;

  @ApiPropertyOptional({ description: "Date d'attribution" })
  @IsDateString()
  @IsOptional()
  attributedAt?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'ID de la demande liée' })
  @IsString()
  @IsOptional()
  demandId?: string;
}
