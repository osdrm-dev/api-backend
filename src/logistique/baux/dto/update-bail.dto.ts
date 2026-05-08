import { PartialType } from '@nestjs/swagger';
import { CreateBailDto } from './create-bail.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { LgBailStatut } from '@prisma/client';

export class UpdateBailDto extends PartialType(CreateBailDto) {
  @ApiPropertyOptional({ enum: LgBailStatut })
  @IsOptional()
  @IsEnum(LgBailStatut)
  statut?: LgBailStatut;
}
