import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestSigningDto {
  @ApiPropertyOptional({
    description: 'Numéro de page (1-based)',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  pageNumber?: number;

  @ApiProperty({
    description: 'Position horizontale, en pourcentage de la page (0–1)',
    example: 0.1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  positionX: number;

  @ApiProperty({
    description: 'Position verticale, en pourcentage de la page (0–1)',
    example: 0.8,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  positionY: number;

  @ApiPropertyOptional({
    description: 'Largeur de la signature, en pourcentage de la page (0–1)',
    default: 0.2,
    example: 0.2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  signatureWidth?: number;
}
