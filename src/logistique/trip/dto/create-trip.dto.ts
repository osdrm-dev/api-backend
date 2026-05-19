import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LgTransportMode } from '@prisma/client';

export class CreateTripDto {
  @ApiProperty({ example: 'Antananarivo' })
  @IsString()
  @MaxLength(255)
  departureLocation: string;

  @ApiProperty({ example: 'Fianarantsoa' })
  @IsString()
  @MaxLength(255)
  arrivalLocation: string;

  @ApiProperty({ example: '2026-05-20' })
  @IsDateString()
  departureDate: string;

  @ApiPropertyOptional({ example: '2026-05-21' })
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @ApiProperty({ example: 'Réunion de coordination régionale' })
  @IsString()
  @MaxLength(500)
  purpose: string;

  @ApiProperty({ enum: LgTransportMode })
  @IsEnum(LgTransportMode)
  transportMode: LgTransportMode;

  @ApiPropertyOptional({
    example: 12450.0,
    description: 'Relevé kilométrique au départ (tableau de bord)',
  })
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  departureKm?: number;

  @ApiPropertyOptional({
    example: 12615.0,
    description: "Relevé kilométrique à l'arrivée (tableau de bord)",
  })
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  arrivalKm?: number;

  @ApiPropertyOptional({ example: 'Prévoir escale à mi-chemin' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    example: 'cm1abc...',
    description:
      'ID du véhicule de service assigné (uniquement pour SERVICE_VEHICLE)',
  })
  @IsOptional()
  @IsString()
  vehicleId?: string;
}
