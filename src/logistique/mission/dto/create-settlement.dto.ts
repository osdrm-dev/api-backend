import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSettlementDto {
  @ApiProperty({ example: 15000, description: 'Frais de transport en Ariary' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transportCost: number;

  @ApiProperty({ example: 30000, description: "Frais d'hébergement en Ariary" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accommodationCost: number;

  @ApiProperty({
    example: 20000,
    description: 'Frais de restauration en Ariary',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mealCost: number;

  @ApiPropertyOptional({
    example: 5000,
    default: 0,
    description: 'Autres frais divers en Ariary',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherCosts?: number;

  @ApiPropertyOptional({ example: 'Trajet effectué sans incident.' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
