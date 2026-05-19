import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { LgCarburantStatus } from '@prisma/client';

const ALLOWED_STATUSES = [
  LgCarburantStatus.PROCESSED,
  LgCarburantStatus.CANCELLED,
] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export class UpdateCarburantStatusDto {
  @ApiProperty({
    enum: ALLOWED_STATUSES,
    description: 'Nouveau statut (PROCESSED ou CANCELLED)',
  })
  @IsEnum(LgCarburantStatus)
  status: AllowedStatus;
}
