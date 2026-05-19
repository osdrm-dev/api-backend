import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LgTypeCarburant } from '@prisma/client';

export class CreateCarburantDto {
  @ApiPropertyOptional({
    example: 'clx12345abcde',
    description: 'ID du véhicule (vehicleId ou immatriculation requis)',
  })
  @ValidateIf((o: CreateCarburantDto) => !o.immatriculation)
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({
    example: 'AB-123-CD',
    description:
      'Immatriculation du véhicule (vehicleId ou immatriculation requis)',
  })
  @ValidateIf((o: CreateCarburantDto) => !o.vehicleId)
  @IsString()
  immatriculation?: string;

  @ApiProperty({ example: '2026-05-15' })
  @IsDateString()
  dateApprovisionnement: string;

  @ApiProperty({ enum: LgTypeCarburant })
  @IsEnum(LgTypeCarburant)
  typeCarburant: LgTypeCarburant;

  @ApiProperty({ example: 50.5, description: 'Volume en litres' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  volumeLitres: number;

  @ApiPropertyOptional({
    example: 4500.5,
    description: 'Prix unitaire MGA/litre',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Type(() => Number)
  prixUnitaire?: number;

  @ApiProperty({ example: 227525, description: 'Montant total MGA' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  montantTotal: number;

  @ApiPropertyOptional({
    example: 12450,
    description: 'Kilométrage au moment du plein',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  kilometrage?: number;

  @ApiPropertyOptional({ example: 'Station Total Analakely', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  station?: string;

  @ApiPropertyOptional({ example: 'Plein complet', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
