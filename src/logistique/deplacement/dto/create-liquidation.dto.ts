import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLiquidationDto {
  @ApiProperty({ example: 15000, description: 'Frais de transport en Ariary' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fraisTransport: number;

  @ApiProperty({ example: 30000, description: "Frais d'hébergement en Ariary" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fraisHebergement: number;

  @ApiProperty({
    example: 20000,
    description: 'Frais de restauration en Ariary',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fraisRestauration: number;

  @ApiPropertyOptional({
    example: 5000,
    default: 0,
    description: 'Autres frais divers en Ariary',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  autresFrais?: number;

  @ApiPropertyOptional({ example: 'Déplacement effectué sans incident.' })
  @IsOptional()
  @IsString()
  observations?: string;
}
