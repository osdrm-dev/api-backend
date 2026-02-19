import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UploadBcDto {
  @ApiProperty({
    description: 'Nom du fichier du Bon de commande',
    example: 'bon-de-commande-001.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({
    description: 'URL du fichier du Bon de Commande',
    example: 'https://storage.example.com/purchase-orders/bc-001.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiPropertyOptional({
    description: 'Taille du fichier en octets',
    example: 204800,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Type MIME du fichier',
    example: 'application/pdf',
  })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Description du Bon de Commande',
    example: 'Bon de Commande pour matériel informatique',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Nom de l’utilisateur qui a uploadé le fichier',
    example: 'Acheteur Principal',
  })
  @IsString()
  @IsOptional()
  uploadedBy?: string;
}
