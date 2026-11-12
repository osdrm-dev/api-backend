import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAttachmentDto } from '../dto/attachment.dto';
import { Role } from '@prisma/client';
import { AppException, ErrorCode } from 'src/common/errors';

@Injectable()
export class AttachmentService {
  constructor(private readonly prisma: PrismaService) {}

  async createAttachment(
    userId: number,
    purchaseId: string,
    dto: CreateAttachmentDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'User not found',
      );
    }

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
    }

    if (dto.type === 'PURCHASE_ORDER' && user.role !== Role.ACHETEUR) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_BUYER_ONLY,
        'Only a buyer can perform this action',
      );
    }

    if (dto.type === 'PURCHASE_ORDER' && purchase.currentStep !== 'BC') {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_NOT_AT_STEP_BC,
        'Purchase is not at step BC',
      );
    }

    const file = await this.prisma.file.findUnique({
      where: { id: dto.fileId },
    });

    console.log('file here');
    if (!file) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'File not found',
      );
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        purchaseId,
        fileId: dto.fileId, // ← fix : lier le fichier
        type: dto.type,
        fileName: file.originalName,
        fileUrl: `/files/${file.storedName}`,
        fileSize: file.size,
        mimeType: file.mimeType,
        description: dto.description,
        uploadedBy: user.name, // ← utiliser user.name plutôt que userId.toString()
      },
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      type: attachment.type,
      message: 'Document ajoute avec succes',
    };
  }

  async deleteAttachment(
    userId: number,
    purchaseId: string,
    attachmentId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'User not found',
      );
    }

    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.purchaseId !== purchaseId) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Attachment not found',
      );
    }

    if (attachment.type === 'PURCHASE_ORDER' && user.role !== Role.ACHETEUR) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_BUYER_ONLY,
        'Only a buyer can perform this action',
      );
    }

    await this.prisma.attachment.delete({
      where: { id: attachmentId },
    });

    return {
      message: 'Document supprime avec succes',
    };
  }

  async listAttachments(purchaseId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
    }

    const attachments = await this.prisma.attachment.findMany({
      where: { purchaseId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      purchaseId,
      attachments,
      total: attachments.length,
    };
  }
}
