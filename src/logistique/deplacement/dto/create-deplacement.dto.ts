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
import { LgTypeMission } from '@prisma/client';

export class CreateDeplacementDto {
  @ApiProperty({ example: 'Mission de supervision terrain' })
  @IsString()
  @IsNotEmpty()
  objet: string;

  @ApiProperty({ example: 'Fianarantsoa' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ example: '2026-05-10' })
  @IsDateString()
  dateDepart: string;

  @ApiProperty({ example: '2026-05-14' })
  @IsDateString()
  dateRetour: string;

  @ApiProperty({ enum: LgTypeMission })
  @IsEnum(LgTypeMission)
  typeMission: LgTypeMission;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nombrePersonnes?: number;

  @ApiPropertyOptional({ type: [String], example: ['Jean Dupont'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  passagers?: string[];

  @ApiPropertyOptional({ example: 'Visite de projet en région' })
  @IsOptional()
  @IsString()
  justification?: string;
}
