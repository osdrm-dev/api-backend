import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EquipmentAttributionStatus } from '@prisma/client';

export class FilterEquipmentAttributionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  beneficiaryId?: number;

  @ApiPropertyOptional({ enum: EquipmentAttributionStatus })
  @IsEnum(EquipmentAttributionStatus)
  @IsOptional()
  status?: EquipmentAttributionStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  demandId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
