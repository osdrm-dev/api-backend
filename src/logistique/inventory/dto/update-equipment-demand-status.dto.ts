import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EquipmentDemandStatus } from '@prisma/client';

export class UpdateEquipmentDemandStatusDto {
  @ApiProperty({
    enum: [EquipmentDemandStatus.APPROUVEE, EquipmentDemandStatus.REFUSEE],
    description: 'Nouveau statut de la demande',
  })
  @IsEnum(EquipmentDemandStatus)
  status!: EquipmentDemandStatus;

  @ApiPropertyOptional({ description: "Note de l'administrateur" })
  @IsString()
  @IsOptional()
  adminNote?: string;
}
