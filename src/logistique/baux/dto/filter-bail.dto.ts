import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { LgBailStatut, LgBailType } from '@prisma/client';

export class FilterBailDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: LgBailStatut })
  @IsOptional()
  @IsEnum(LgBailStatut)
  statut?: LgBailStatut;

  @ApiPropertyOptional({ enum: LgBailType })
  @IsOptional()
  @IsEnum(LgBailType)
  type?: LgBailType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  site?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeArchived?: boolean = false;
}
