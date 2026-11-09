import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { EquipmentStatus } from '@prisma/client';

export class ReturnEquipmentAttributionDto {
  @ApiPropertyOptional({ description: 'Date de retour' })
  @IsDateString()
  @IsOptional()
  returnedAt?: string;

  @ApiPropertyOptional({
    enum: EquipmentStatus,
    description: "État de l'actif au retour",
  })
  @IsEnum(EquipmentStatus)
  @IsOptional()
  returnCondition?: EquipmentStatus;

  @ApiPropertyOptional({ description: 'Notes sur le retour' })
  @IsString()
  @IsOptional()
  notes?: string;
}
