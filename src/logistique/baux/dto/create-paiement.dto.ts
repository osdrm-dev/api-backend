import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LgBailPaiementType } from '@prisma/client';

export class CreatePaiementDto {
  @ApiProperty({ example: '2025-04', description: 'Période au format YYYY-MM' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'La période doit être au format YYYY-MM',
  })
  periode: string;

  @ApiProperty({ example: 500000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montantPaye: number;

  @ApiProperty({ example: '2025-04-05' })
  @IsDateString()
  datePaiement: string;

  @ApiProperty({ enum: LgBailPaiementType, default: LgBailPaiementType.LOYER })
  @IsEnum(LgBailPaiementType)
  typePaiement: LgBailPaiementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
