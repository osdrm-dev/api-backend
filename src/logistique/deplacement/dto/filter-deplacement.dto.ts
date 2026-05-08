import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { LgDeplacementStatus, LgTypeMission } from '@prisma/client';

export class FilterDeplacementDto {
  @ApiPropertyOptional({ enum: LgDeplacementStatus })
  @IsOptional()
  @IsEnum(LgDeplacementStatus)
  status?: LgDeplacementStatus;

  @ApiPropertyOptional({ enum: LgTypeMission })
  @IsOptional()
  @IsEnum(LgTypeMission)
  typeMission?: LgTypeMission;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  requestorId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}
