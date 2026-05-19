import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class UpdateTripStatusDto {
  @ApiProperty({ enum: ['PROCESSED', 'CANCELLED'] })
  @IsEnum(['PROCESSED', 'CANCELLED'])
  status: 'PROCESSED' | 'CANCELLED';
}
