import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAttachmentDto } from '../dto/attachment.dto';
import { Role } from '@prisma/client';

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
      throw new NotFoundException('Utilisateur non trouve');
    }

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    // Vérifier les permissions selon le type
    if (dto.type === 'PURCHASE_ORDER' && user.role !== Role.ACHETEUR) {
      throw new ForbiddenException(
        'Seul un ACHETEUR peut ajouter un bon de commande',
      );
    }

    // Vérifier que la purchase est à la bonne étape
    if (dto.type === 'PURCHASE_ORDER' && purchase.currentStep !== 'BC') {
      throw new BadRequestException(
        "La DA doit être à l'étape BC pour ajouter un bon de commande",
      );
    }

    // Vérifier que le fichier existe
    const file = await this.prisma.file.findUnique({
      where: { id: dto.fileId },
    });

    if (!file) {
      throw new NotFoundException('Fichier non trouve');
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        purchaseId,
        type: dto.type,
        fileName: file.originalName,
        fileUrl: `/files/${file.storedName}`,
        fileSize: file.size,
        mimeType: file.mimeType,
        description: dto.description,
        uploadedBy: userId.toString(),
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
      throw new NotFoundException('Utilisateur non trouve');
    }

    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.purchaseId !== purchaseId) {
      throw new NotFoundException('Document non trouve');
    }

    // Vérifier les permissions
    if (attachment.type === 'PURCHASE_ORDER' && user.role !== Role.ACHETEUR) {
      throw new ForbiddenException(
        'Seul un ACHETEUR peut supprimer un bon de commande',
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
      throw new NotFoundException("Demande d'achat non trouvee");
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
