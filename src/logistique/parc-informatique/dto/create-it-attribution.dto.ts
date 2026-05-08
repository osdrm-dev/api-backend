import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItAttributionDto {
  @ApiProperty({ description: "ID de l'actif à attribuer" })
  @IsString()
  @IsNotEmpty()
  assetId!: string;

  @ApiProperty({ description: 'ID du bénéficiaire', example: 3 })
  @IsInt()
  @Type(() => Number)
  beneficiaryId!: number;

  @ApiProperty({ description: 'Quantité attribuée', example: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

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
