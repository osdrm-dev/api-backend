import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LgDeplacementStatus } from '@prisma/client';

export class UpdateDeplacementStatusDto {
  @ApiProperty({ enum: LgDeplacementStatus })
  @IsEnum(LgDeplacementStatus)
  status: LgDeplacementStatus;

  @ApiPropertyOptional({
    example: 'Aucun véhicule disponible pour cette période.',
  })
  @IsOptional()
  @IsString()
  motifRefus?: string;
}
