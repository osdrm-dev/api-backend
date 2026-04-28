import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ItAssetStatus } from '@prisma/client';

export class ReturnItAttributionDto {
  @ApiPropertyOptional({ description: 'Date de retour' })
  @IsDateString()
  @IsOptional()
  returnedAt?: string;

  @ApiPropertyOptional({
    enum: ItAssetStatus,
    description: "État de l'actif au retour",
  })
  @IsEnum(ItAssetStatus)
  @IsOptional()
  returnCondition?: ItAssetStatus;

  @ApiPropertyOptional({ description: 'Notes sur le retour' })
  @IsString()
  @IsOptional()
  notes?: string;
}
