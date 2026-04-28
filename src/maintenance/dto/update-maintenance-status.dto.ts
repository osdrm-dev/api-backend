import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MaintenanceStatus } from '@prisma/client';

export class UpdateMaintenanceStatusDto {
  @ApiProperty({
    description: 'Nouveau statut de la demande',
    enum: MaintenanceStatus,
    example: MaintenanceStatus.IN_PROGRESS,
  })
  @IsEnum(MaintenanceStatus)
  @IsNotEmpty()
  status!: MaintenanceStatus;

  @ApiPropertyOptional({
    description: "Note administrative (observations de l'admin)",
    example: 'Intervention planifiée pour la semaine prochaine.',
  })
  @IsString()
  @IsOptional()
  adminNote?: string;
}
