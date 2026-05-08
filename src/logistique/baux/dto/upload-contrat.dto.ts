import { ApiProperty } from '@nestjs/swagger';
import type { File as MulterFile } from 'multer';

export class UploadContratDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Fichier PDF du contrat (max 10 MB)',
  })
  file: MulterFile;
}
