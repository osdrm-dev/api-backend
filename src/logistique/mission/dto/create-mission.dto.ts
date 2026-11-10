import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LgMissionType } from '@prisma/client';

export class CreateMissionDto {
  @ApiProperty({ example: 'Mission de supervision terrain' })
  @IsString()
  @IsNotEmpty()
  purpose: string;

  @ApiProperty({ example: 'Fianarantsoa' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ example: '2026-05-10' })
  @IsDateString()
  departureDate: string;

  @ApiProperty({ example: '2026-05-14' })
  @IsDateString()
  returnDate: string;

  @ApiProperty({ enum: LgMissionType })
  @IsEnum(LgMissionType)
  missionType: LgMissionType;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  passengerCount?: number;

  @ApiPropertyOptional({ type: [String], example: ['Jean Dupont'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  passengers?: string[];

  @ApiPropertyOptional({ example: 'Visite de projet en région' })
  @IsOptional()
  @IsString()
  justification?: string;
}
