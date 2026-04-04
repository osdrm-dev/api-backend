import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSatisfactionDto {
  @ApiProperty({ description: 'Note globale (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Commentaire optionnel', required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({
    description: 'Note de livraison (1-5)',
    required: false,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  deliveryRating?: number;

  @ApiProperty({
    description: 'Note de qualité (1-5)',
    required: false,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  qualityRating?: number;

  @ApiProperty({
    description: 'Note de service (1-5)',
    required: false,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  serviceRating?: number;

  @ApiProperty({
    description: 'ID du fichier joint (optionnel)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  attachmentFileId?: number;
}
