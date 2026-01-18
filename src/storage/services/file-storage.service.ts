import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'prisma/prisma.service';
import { FileOptimizationService } from 'src/storage/services/file-otpimizations.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileType, FileStatus, File } from '@prisma/client';
import type { Express } from 'express';
import type { File as MulterFile } from 'multer';

interface UploadOptions {
  userId: number;
  allowedTypes?: string[];
  maxSize?: number;
  skipOptimization?: boolean;
  metadata?: Record<string, any>;
}

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly uploadDir: string;
  private readonly defaultMaxFileSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileOptimization: FileOptimizationService,
    private readonly configService: ConfigService,
  ) {
    this.uploadDir =
      this.configService.get<string>('UPLOAD_DIR') || './uploads';
    this.defaultMaxFileSize =
      this.configService.get<number>('MAX_FILE_SIZE') || 10485760;
    this.ensureUploadDirExists();
  }

  private async ensureUploadDirExists() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadDir}`);
    }
  }

  async upload(file: MulterFile, options: UploadOptions): Promise<File> {
    const maxSize = options.maxSize || this.defaultMaxFileSize;

    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${maxSize / 1048576}MB`,
      );
    }

    if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`,
      );
    }

    const fileType = this.determineFileType(file.mimetype);
    const checksum = await this.calculateChecksum(file.buffer);

    const existingFile = await this.prisma.file.findFirst({
      where: {
        checksum,
        uploadedById: options.userId,
      },
    });

    if (existingFile) {
      this.logger.log(
        `Duplicate file detected, returning existing: ${existingFile.id}`,
      );
      return existingFile;
    }

    const storedName = this.generateStoredName(file.originalname);
    const filePath = path.join(this.uploadDir, storedName);

    await fs.writeFile(filePath, file.buffer);

    const fileRecord = await this.prisma.file.create({
      data: {
        originalName: file.originalname,
        storedName,
        mimeType: file.mimetype,
        fileType,
        size: file.size,
        path: filePath,
        url: `/api/files/${storedName}`,
        status: FileStatus.UPLOADING,
        uploadedById: options.userId,
        checksum,
        metadata: options.metadata || { encoding: file.encoding },
      },
    });

    if (!options.skipOptimization) {
      setImmediate(() => {
        this.optimizeFileAsync(fileRecord.id, filePath, file.mimetype);
      });
    } else {
      await this.prisma.file.update({
        where: { id: fileRecord.id },
        data: { status: FileStatus.OPTIMIZED },
      });
    }

    return fileRecord;
  }

  async uploadMultiple(
    files: MulterFile[],
    options: UploadOptions,
  ): Promise<File[]> {
    const uploadPromises = files.map((file) => this.upload(file, options));
    return Promise.all(uploadPromises);
  }

  private async optimizeFileAsync(
    fileId: number,
    filePath: string,
    mimeType: string,
  ) {
    try {
      await this.prisma.file.update({
        where: { id: fileId },
        data: { status: FileStatus.PROCESSING },
      });

      const result = await this.fileOptimization.optimizeFile(
        filePath,
        mimeType,
      );

      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          optimizedSize: result.optimizedSize,
          compressionRatio: result.compressionRatio,
          status: FileStatus.OPTIMIZED,
          path: result.optimizedPath,
        },
      });

      this.logger.log(`File optimized: ${fileId}`);
    } catch (error) {
      this.logger.error(`Error optimizing file ${fileId}:`, error);
      await this.prisma.file.update({
        where: { id: fileId },
        data: { status: FileStatus.FAILED },
      });
    }
  }

  async getById(fileId: number): Promise<File> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async getByIds(fileIds: number[]): Promise<File[]> {
    return this.prisma.file.findMany({
      where: { id: { in: fileIds } },
    });
  }

  async getBuffer(fileId: number): Promise<Buffer> {
    const file = await this.getById(fileId);

    try {
      return await fs.readFile(file.path);
    } catch (error) {
      this.logger.error(`Error reading file ${fileId}:`, error);
      throw new NotFoundException('File not found on disk');
    }
  }

  async delete(fileId: number): Promise<void> {
    const file = await this.getById(fileId);

    try {
      await fs.unlink(file.path);
    } catch (error) {
      this.logger.error(`Error deleting file from disk: ${fileId}`, error);
    }

    await this.prisma.file.delete({
      where: { id: fileId },
    });

    this.logger.log(`File deleted: ${fileId}`);
  }

  async deleteMultiple(fileIds: number[]): Promise<void> {
    const deletePromises = fileIds.map((id) => this.delete(id));
    await Promise.all(deletePromises);
  }

  async updateMetadata(
    fileId: number,
    metadata: Record<string, any>,
  ): Promise<File> {
    return this.prisma.file.update({
      where: { id: fileId },
      data: { metadata },
    });
  }

  async exists(fileId: number): Promise<boolean> {
    const count = await this.prisma.file.count({
      where: { id: fileId },
    });
    return count > 0;
  }

  getFileUrl(file: File): string {
    return file.url;
  }

  getFilePublicUrl(file: File, baseUrl?: string): string {
    const base = baseUrl || this.configService.get<string>('APP_URL') || '';
    return `${base}${file.url}`;
  }

  private determineFileType(mimeType: string): FileType {
    if (mimeType.startsWith('image/')) {
      return FileType.IMAGE;
    } else if (mimeType === 'application/pdf') {
      return FileType.PDF;
    } else if (
      mimeType === 'application/msword' ||
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return FileType.DOCUMENT;
    } else if (
      mimeType === 'application/vnd.ms-excel' ||
      mimeType ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return FileType.SPREADSHEET;
    }
    return FileType.OTHER;
  }

  private generateStoredName(originalName: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `${timestamp}-${random}${ext}`;
  }

  private async calculateChecksum(buffer: Buffer): Promise<string> {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
  async getByStoredName(storedName: string): Promise<File> {
    const file = await this.prisma.file.findUnique({
      where: { storedName },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }
}
