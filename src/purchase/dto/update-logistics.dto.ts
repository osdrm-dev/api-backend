import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateLogisticsDto {
  @ApiPropertyOptional({
    description: 'Adresse de livraison',
    example: 'Region Bureau',
  })
  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @ApiPropertyOptional({
    description: 'Date de livraison souhaitee',
    example: '2026-02-24',
  })
  @IsOptional()
  requestedDeliveryDate?: Date;

  @ApiPropertyOptional({
    description: 'Remarques et observations',
    example: 'Livraison urgente',
  })
  @IsString()
  @IsOptional()
  observations?: string;
}
