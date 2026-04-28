import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ItAttributionStatus } from '@prisma/client';

export class FilterItAttributionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  beneficiaryId?: number;

  @ApiPropertyOptional({ enum: ItAttributionStatus })
  @IsEnum(ItAttributionStatus)
  @IsOptional()
  status?: ItAttributionStatus;

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
