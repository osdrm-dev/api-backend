import { Injectable, BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

@Injectable()
export class UploadService {
  private readonly allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  validateFile(file: UploadedFile): void {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non autorisé. Types acceptés: PDF, Images, Word, Excel`,
      );
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `Fichier trop volumineux. Taille maximale: 10MB`,
      );
    }
  }

  generateFileName(originalName: string): string {
    const ext = extname(originalName);
    const uuid = uuidv4();
    return `${uuid}${ext}`;
  }

  getFileUrl(filename: string, baseUrl: string): string {
    return `${baseUrl}/uploads/${filename}`;
  }
}
