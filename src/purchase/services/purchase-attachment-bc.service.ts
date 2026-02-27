import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentType, Role, PurchaseStep } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { UploadBcDto } from '../dto/upload-bc.dto';

@Injectable()
export class PurchaseAttachmentBcService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadBcAttachment(
    user: { id: number; role: Role },
    purchaseId: string,
    dto: UploadBcDto,
  ) {
    if (user.role !== Role.ACHETEUR) {
      throw new ForbiddenException(
        'Seul un utilisateur ACHETEUR peut uploader un BC',
      );
    }

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.currentStep !== PurchaseStep.BC) {
      throw new BadRequestException("Cette DA n'est pas a l'etape QR");
    }

    const existingBC = await this.prisma.attachment.findFirst({
      where: { purchaseId, type: AttachmentType.PURCHASE_ORDER },
    });

    if (existingBC) {
      throw new ForbiddenException(
        'Un Bon de Commande existe deja pour cette purchase',
      );
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        purchaseId: purchase.id,
        type: AttachmentType.PURCHASE_ORDER,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        description: dto.description ?? 'Bon de Commande',
        uploadedBy: dto.uploadedBy ?? user.id.toString(),
      },
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      message: 'BC telecharge avec succes',
    };
  }

  async deleteBCAttachment(userId: number, purchaseId: string, bcId: string) {
    // Vérifier que la purchase existe
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvée");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new ForbiddenException(
        'Accès refusé - seul un ACHETEUR peut supprimer un BC',
      );
    }

    const bc = await this.prisma.attachment.findUnique({
      where: { id: bcId },
    });
    if (
      !bc ||
      bc.purchaseId !== purchaseId ||
      bc.type !== AttachmentType.PURCHASE_ORDER
    ) {
      throw new NotFoundException('Bon de Commande non trouvé');
    }

    await this.prisma.attachment.delete({ where: { id: bcId } });

    return {
      message: 'Bon de Commande supprimé avec succès',
    };
  }
}
