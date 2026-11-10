import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LgMissionStatus } from '@prisma/client';

export class UpdateMissionStatusDto {
  @ApiProperty({ enum: LgMissionStatus })
  @IsEnum(LgMissionStatus)
  status: LgMissionStatus;

  @ApiPropertyOptional({
    example: 'Aucun véhicule disponible pour cette période.',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
