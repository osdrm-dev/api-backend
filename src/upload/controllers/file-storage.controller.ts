import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  Req,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FileStorageService } from '../services/file-storage.service';
import { UploadService } from '../services/upload.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AttachmentType } from '@prisma/client';
import { UploadFileDto, UploadMultipleFilesDto } from '../dto/upload-file.dto';

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

@ApiTags('File Storage')
@ApiBearerAuth()
@Controller('file-storage')
@UseGuards(JwtAuthGuard)
export class FileStorageController {
  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly uploadService: UploadService,
  ) {}

  @Post(':purchaseId/upload')
  @ApiOperation({ summary: 'Upload un fichier et créer attachment' })
  @ApiParam({ name: 'purchaseId', description: 'ID de la purchase' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: Object.values(AttachmentType) },
        description: { type: 'string' },
        uploadedBy: { type: 'string' },
      },
      required: ['file', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Fichier uploadé avec succès' })
  @ApiResponse({ status: 400, description: 'Fichier invalide ou manquant' })
  @ApiResponse({ status: 404, description: 'Purchase non trouvée' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @Param('purchaseId') purchaseId: string,
    @UploadedFile() file: UploadedFile,
    @Body() dto: UploadFileDto,
    @Req() req,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    this.uploadService.validateFile(file);

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const attachment = await this.fileStorageService.uploadAndCreateAttachment({
      purchaseId,
      type: dto.type,
      file,
      baseUrl,
      description: dto.description,
      uploadedBy: dto.uploadedBy,
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      type: attachment.type,
      message: 'Fichier uploadé et enregistré avec succès',
    };
  }

  @Post(':purchaseId/upload-multiple')
  @ApiOperation({ summary: 'Upload plusieurs fichiers' })
  @ApiParam({ name: 'purchaseId', description: 'ID de la purchase' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        type: { type: 'string', enum: Object.values(AttachmentType) },
        uploadedBy: { type: 'string' },
      },
      required: ['files', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Fichiers uploadés avec succès' })
  @ApiResponse({ status: 400, description: 'Fichiers invalides ou manquants' })
  @ApiResponse({ status: 404, description: 'Purchase non trouvée' })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadMultipleFiles(
    @Param('purchaseId') purchaseId: string,
    @UploadedFiles() files: UploadedFile[],
    @Body() dto: UploadMultipleFilesDto,
    @Req() req,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    files.forEach((file) => this.uploadService.validateFile(file));

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const attachments =
      await this.fileStorageService.uploadMultipleAndCreateAttachments(
        purchaseId,
        dto.type,
        files,
        baseUrl,
        dto.uploadedBy,
      );

    return {
      attachments: attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
      })),
      count: attachments.length,
      message: `${attachments.length} fichiers uploadés avec succès`,
    };
  }

  @Get(':purchaseId/attachments')
  @ApiOperation({ summary: "Récupérer les attachments d'une purchase" })
  @ApiParam({ name: 'purchaseId', description: 'ID de la purchase' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: AttachmentType,
    description: 'Filtrer par type',
  })
  @ApiResponse({
    status: 200,
    description: 'Attachments récupérés avec succès',
  })
  async getAttachments(
    @Param('purchaseId') purchaseId: string,
    @Query('type') type?: AttachmentType,
  ) {
    const attachments = await this.fileStorageService.getAttachmentsByPurchase(
      purchaseId,
      type,
    );

    return {
      purchaseId,
      attachments,
      total: attachments.length,
    };
  }

  @Delete('attachment/:id')
  @ApiOperation({ summary: 'Supprimer un attachment (DB + fichier)' })
  @ApiParam({ name: 'id', description: "ID de l'attachment" })
  @ApiResponse({ status: 200, description: 'Attachment supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Attachment non trouvé' })
  @ApiResponse({
    status: 500,
    description: 'Erreur lors de la suppression du fichier',
  })
  async deleteAttachment(@Param('id') id: string) {
    return this.fileStorageService.deleteAttachment(id);
  }
}
