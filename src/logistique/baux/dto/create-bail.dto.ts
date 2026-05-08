import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LgBailType } from '@prisma/client';

export class CreateBailDto {
  @ApiProperty({ enum: LgBailType })
  @IsEnum(LgBailType)
  type: LgBailType;

  @ApiProperty({ example: 'Nom du bailleur' })
  @IsString()
  @IsNotEmpty()
  bailleur: string;

  @ApiProperty({ example: 'Nom du preneur' })
  @IsString()
  @IsNotEmpty()
  preneur: string;

  @ApiProperty({ example: 'Bureau principal - Plateau' })
  @IsString()
  @IsNotEmpty()
  objetBail: string;

  @ApiPropertyOptional({ example: 'Abidjan' })
  @IsOptional()
  @IsString()
  site?: string;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  dateSignature?: string;

  @ApiProperty({ example: '2024-02-01' })
  @IsDateString()
  dateDebut: string;

  @ApiProperty({ example: '2027-01-31' })
  @IsDateString()
  dateFin: string;

  @ApiProperty({ example: 500000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montantMensuel: number;

  @ApiPropertyOptional({ example: 1000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montantDepotGarantie?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conditionsParticulieres?: string;

  @ApiPropertyOptional({ example: 3.5, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  indexationRate?: number;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 12, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  indexationMois?: number;
}
