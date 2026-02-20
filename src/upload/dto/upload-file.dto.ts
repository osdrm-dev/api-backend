import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AttachmentType } from '@prisma/client';

export class UploadFileDto {
  @ApiProperty({
    description: "Type d'attachment",
    enum: AttachmentType,
    example: AttachmentType.QUOTE,
  })
  @IsEnum(AttachmentType)
  type: AttachmentType;

  @ApiPropertyOptional({
    description: 'Description du fichier',
    example: 'Devis du fournisseur A',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Nom de la personne qui upload',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  uploadedBy?: string;
}

export class UploadMultipleFilesDto {
  @ApiProperty({
    description: "Type d'attachment",
    enum: AttachmentType,
    example: AttachmentType.QUOTE,
  })
  @IsEnum(AttachmentType)
  type: AttachmentType;

  @ApiPropertyOptional({
    description: 'Nom de la personne qui upload',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  uploadedBy?: string;
}
