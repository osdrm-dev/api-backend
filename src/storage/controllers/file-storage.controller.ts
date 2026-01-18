import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  ParseIntPipe,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { FileStorageService } from '../services/file-storage.service';
import { createReadStream } from 'fs';

@ApiTags('Files')
@Controller('files')
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  @Get(':storedName')
  @ApiOperation({ summary: 'Serve a file by its stored name' })
  @ApiResponse({ status: 200, description: 'File served' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async serveFile(
    @Param('storedName') storedName: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.fileStorageService.getByStoredName(storedName);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${file.originalName}"`,
    });

    const stream = createReadStream(file.path);
    return new StreamableFile(stream);
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Download a file by ID' })
  @ApiResponse({ status: 200, description: 'File downloaded' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async downloadFile(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.fileStorageService.getById(id);

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.originalName}"`,
    });

    const stream = createReadStream(file.path);
    return new StreamableFile(stream);
  }
}
