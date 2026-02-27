import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'File to upload',
  })
  file: any;

  @ApiProperty({ required: false, example: 'devis' })
  @IsOptional()
  @IsString()
  relatedResource?: string;

  @ApiProperty({ required: false, example: '123' })
  @IsOptional()
  @IsString()
  relatedResourceId?: string;
}

export class UploadBodyDto {
  @ApiProperty({ required: false, example: 'devis' })
  @IsOptional()
  @IsString()
  relatedResource?: string;

  @ApiProperty({ required: false, example: '123' })
  @IsOptional()
  @IsString()
  relatedResourceId?: string;
}

export class FileResponseDto {
  id: number;
  originalName: string;
  storedName: string;
  mimeType: string;
  fileType: string;
  size: number;
  optimizedSize?: number;
  compressionRatio?: number;
  url: string;
  status: string;
  createdAt: Date;
}
