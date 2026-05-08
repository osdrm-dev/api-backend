import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAvenantDto {
  @ApiProperty({ example: 'AV-001' })
  @IsString()
  @IsNotEmpty()
  numero: string;

  @ApiPropertyOptional({ example: '2025-03-01' })
  @IsOptional()
  @IsDateString()
  dateSignature?: string;

  @ApiProperty({ example: 'Modification du loyer suite à indexation annuelle' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 525000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nouveauMontant?: number;
}
