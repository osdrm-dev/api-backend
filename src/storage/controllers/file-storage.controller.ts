import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  NotFoundException,
  ParseIntPipe,
  StreamableFile,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { File as MulterFile } from 'multer';
import { FileStorageService } from '../services/file-storage.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import {
  UploadFileDto,
  UploadBodyDto,
  FileResponseDto,
} from '../dto/upload.dto';

@ApiTags('Files')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileDto })
  @ApiResponse({
    status: 201,
    description: 'File successfully uploaded',
    type: FileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size exceeded',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadFile(
    @UploadedFile() file: MulterFile,
    @Body() uploadBodyDto: UploadBodyDto,
    @CurrentUser('id') userId: number,
  ): Promise<FileResponseDto> {
    const result = await this.fileStorageService.upload(file, {
      userId,
      metadata: {
        relatedResource: uploadBodyDto.relatedResource,
        relatedResourceId: uploadBodyDto.relatedResourceId,
      },
    });
    return result as unknown as FileResponseDto;
  }

  @Post('upload/multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload multiple files (max 10)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Files to upload (max 10)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Files successfully uploaded',
    type: [FileResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size exceeded',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadMultipleFiles(
    @UploadedFiles() files: MulterFile[],
    @CurrentUser('id') userId: number,
  ): Promise<FileResponseDto[]> {
    const results = await this.fileStorageService.uploadMultiple(files, {
      userId,
    });
    return results as unknown as FileResponseDto[];
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Download a file by ID' })
  @ApiParam({ name: 'id', description: 'Numeric ID of the file', example: 42 })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

  @Get('info/:id')
  @ApiOperation({ summary: 'Get file metadata by ID' })
  @ApiParam({ name: 'id', description: 'Numeric ID of the file', example: 42 })
  @ApiResponse({
    status: 200,
    description: 'File metadata retrieved',
    type: FileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFileInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FileResponseDto> {
    const file = await this.fileStorageService.getById(id);
    return file as unknown as FileResponseDto;
  }

  @Get(':storedName')
  @ApiOperation({ summary: 'Serve a file by its stored name' })
  @ApiParam({
    name: 'storedName',
    description: 'Stored name of the file',
    example: '1718000000000-abc123def.jpg',
  })
  @ApiResponse({ status: 200, description: 'File served successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file by ID' })
  @ApiParam({ name: 'id', description: 'Numeric ID of the file', example: 42 })
  @ApiResponse({ status: 204, description: 'File successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.fileStorageService.delete(id);
  }
}
