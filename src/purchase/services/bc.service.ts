import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  AttachmentType,
  PurchaseStatus,
  PurchaseStep,
  Role,
} from '@prisma/client';

@Injectable()
export class BCService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadBC(
    purchaseId: string,
    userId: number,
    dto: {
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new ForbiddenException('Seul un ACHETEUR peut uploader un BC');
    }

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (purchase.currentStep !== PurchaseStep.BC) {
      throw new BadRequestException("La DA n'est pas a l'etape BC");
    }
    if (purchase.status !== PurchaseStatus.PUBLISHED) {
      throw new BadRequestException(
        'La DA doit etre publiee pour uploader un BC',
      );
    }

    await this.prisma.attachment.deleteMany({
      where: { purchaseId, type: AttachmentType.PURCHASE_ORDER },
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        purchaseId,
        type: AttachmentType.PURCHASE_ORDER,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        uploadedBy: user.name,
      },
    });

    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: PurchaseStatus.AWAITING_DOCUMENTS },
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      message: 'Bon de commande uploade avec succes',
    };
  }

  async getBC(purchaseId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        attachments: {
          where: { type: AttachmentType.PURCHASE_ORDER },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    return { purchaseId, bc: purchase.attachments[0] ?? null };
  }
}
