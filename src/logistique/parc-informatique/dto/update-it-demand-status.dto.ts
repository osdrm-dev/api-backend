import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ItDemandStatus } from '@prisma/client';

export class UpdateItDemandStatusDto {
  @ApiProperty({
    enum: [ItDemandStatus.APPROUVEE, ItDemandStatus.REFUSEE],
    description: 'Nouveau statut de la demande',
  })
  @IsEnum(ItDemandStatus)
  status!: ItDemandStatus;

  @ApiPropertyOptional({ description: "Note de l'administrateur" })
  @IsString()
  @IsOptional()
  adminNote?: string;
}
