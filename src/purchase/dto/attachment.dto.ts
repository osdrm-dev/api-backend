import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttachmentType } from '@prisma/client';

export class CreateAttachmentDto {
  @ApiProperty({
    description: 'ID du fichier uploadé via /files/upload',
    example: 42,
  })
  @IsNumber()
  fileId: number;

  @ApiProperty({
    enum: AttachmentType,
    description: 'Type de document',
    example: 'PURCHASE_ORDER',
  })
  @IsEnum(AttachmentType)
  type: AttachmentType;

  @ApiProperty({
    description: 'Description du document',
    example: 'Bon de commande fournisseur A',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
