import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AttachmentType } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

interface UploadedFile {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
}

interface CreateAttachmentDto {
  purchaseId: string;
  type: AttachmentType;
  file: UploadedFile;
  baseUrl: string;
  description?: string;
  uploadedBy?: string;
}

@Injectable()
export class FileStorageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * Upload un fichier et créer l'entrée Attachment en DB
   */
  async uploadAndCreateAttachment(dto: CreateAttachmentDto) {
    // Vérifier que la purchase existe
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: dto.purchaseId },
    });

    if (!purchase) {
      this.logger.warn("Tentative d'upload sur une purchase inexistante", {
        purchaseId: dto.purchaseId,
      });
      throw new NotFoundException(`Purchase ${dto.purchaseId} non trouvée`);
    }

    const fileUrl = `${dto.baseUrl}/uploads/${dto.file.filename}`;

    const attachment = await this.prisma.attachment.create({
      data: {
        purchaseId: dto.purchaseId,
        type: dto.type,
        fileName: dto.file.originalname,
        fileUrl,
        fileSize: dto.file.size,
        mimeType: dto.file.mimetype,
        description: dto.description,
        uploadedBy: dto.uploadedBy,
      },
    });

    this.logger.info('Fichier uploadé et enregistré', {
      attachmentId: attachment.id,
      purchaseId: dto.purchaseId,
      fileName: dto.file.originalname,
      type: dto.type,
    });

    return attachment;
  }

  /**
   * Upload plusieurs fichiers et créer les entrées Attachment
   */
  async uploadMultipleAndCreateAttachments(
    purchaseId: string,
    type: AttachmentType,
    files: UploadedFile[],
    baseUrl: string,
    uploadedBy?: string,
  ) {
    const attachments = await Promise.all(
      files.map((file) =>
        this.uploadAndCreateAttachment({
          purchaseId,
          type,
          file,
          baseUrl,
          uploadedBy,
        }),
      ),
    );

    return attachments;
  }

  /**
   * Supprimer un attachment (DB + fichier physique)
   */
  async deleteAttachment(attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      this.logger.warn("Tentative de suppression d'un fichier inexistant", {
        attachmentId,
      });
      throw new NotFoundException('Fichier non trouvé');
    }

    // Extraire le nom du fichier depuis l'URL
    const fileName = attachment.fileUrl.split('/uploads/')[1];
    if (fileName) {
      await this.deletePhysicalFile(fileName);
    }

    // Supprimer de la DB
    await this.prisma.attachment.delete({
      where: { id: attachmentId },
    });

    this.logger.info('Fichier supprimé avec succès', {
      attachmentId,
      fileName: attachment.fileName,
      purchaseId: attachment.purchaseId,
    });

    return { message: 'Fichier supprimé avec succès' };
  }

  /**
   * Supprimer le fichier physique
   */
  private async deletePhysicalFile(fileName: string) {
    const filePath = join(process.cwd(), 'uploads', fileName);

    if (existsSync(filePath)) {
      try {
        await unlink(filePath);
        this.logger.debug('Fichier physique supprimé', { fileName, filePath });
      } catch (error) {
        this.logger.error('Erreur lors de la suppression du fichier physique', {
          fileName,
          filePath,
          error: error.message,
        });
        throw new InternalServerErrorException(
          'Erreur lors de la suppression du fichier',
        );
      }
    } else {
      this.logger.warn('Fichier physique introuvable', { fileName, filePath });
    }
  }

  /**
   * Nettoyer les fichiers orphelins (fichiers sans entrée DB)
   */
  async cleanOrphanFiles() {
    // À implémenter si nécessaire
    // Parcourir /uploads et vérifier si chaque fichier existe en DB
  }

  /**
   * Récupérer les attachments d'une purchase
   */
  async getAttachmentsByPurchase(purchaseId: string, type?: AttachmentType) {
    return this.prisma.attachment.findMany({
      where: {
        purchaseId,
        ...(type && { type }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
