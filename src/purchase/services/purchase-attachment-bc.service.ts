import { Injectable, HttpStatus } from '@nestjs/common';
import { AttachmentType, Role, PurchaseStep } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { UploadBcDto } from '../dto/upload-bc.dto';
import { assertIsOwningBuyer } from '../../utils/purchase-guards';
import { AppException, ErrorCode } from 'src/common/errors';

@Injectable()
export class PurchaseAttachmentBcService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadBcAttachment(
    user: { id: number; role: Role },
    purchaseId: string,
    dto: UploadBcDto,
  ) {
    if (user.role !== Role.ACHETEUR) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_BUYER_ONLY,
        'Only a buyer can perform this action',
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

    assertIsOwningBuyer(purchase, user.id);

    if (purchase.currentStep !== PurchaseStep.BC) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_NOT_AT_STEP_BC,
        'Purchase is not at step BC',
      );
    }

    const existingBC = await this.prisma.attachment.findFirst({
      where: { purchaseId, type: AttachmentType.PURCHASE_ORDER },
    });

    if (existingBC) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_BC_ALREADY_EXISTS,
        'A purchase order already exists for this purchase',
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_BUYER_ONLY,
        'Only a buyer can perform this action',
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase order not found',
      );
    }

    await this.prisma.attachment.delete({ where: { id: bcId } });

    return {
      message: 'Bon de Commande supprimé avec succès',
    };
  }
}
