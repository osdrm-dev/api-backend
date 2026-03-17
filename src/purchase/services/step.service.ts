/**
 * DocumentStepService — BR, INVOICE, DAP, PROOF_OF_PAYMENT
 *
 * Spécificités :
 *  - BR   : champ optionnel `justification` si incohérence avec le BC
 *  - DAP  : dérogation possible (même pattern que QR)
 *  - Les autres : upload simple + submit → SubmitService
 */
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
import { SubmitService } from 'src/purchase/services/submit.service';

export type DocStep = 'BR' | 'INVOICE' | 'DAP' | 'PROOF_OF_PAYMENT';

const CFG: Record<
  DocStep,
  { step: PurchaseStep; type: AttachmentType; label: string }
> = {
  BR: {
    step: PurchaseStep.BR,
    type: AttachmentType.DELIVERY_NOTE,
    label: 'Bon de réception',
  },
  INVOICE: {
    step: PurchaseStep.INVOICE,
    type: AttachmentType.INVOICE,
    label: 'Facture',
  },
  DAP: { step: PurchaseStep.DAP, type: AttachmentType.OTHER, label: 'DAP' },
  PROOF_OF_PAYMENT: {
    step: PurchaseStep.PROOF_OF_PAYMENT,
    type: AttachmentType.PROOF_OF_PAYMENT,
    label: 'Preuve de paiement',
  },
};

@Injectable()
export class DocumentStepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly submitService: SubmitService,
  ) {}

  private async assertAcheteur(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new ForbiddenException(
        'Seul un ACHETEUR peut effectuer cette action',
      );
    }
    return user;
  }

  async upload(
    docStep: DocStep,
    purchaseId: string,
    userId: number,
    dto: {
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
      /** BR uniquement : justification si montant ≠ BC */
      justification?: string;
    },
  ) {
    const cfg = CFG[docStep];
    const user = await this.assertAcheteur(userId);

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (purchase.currentStep !== cfg.step) {
      throw new BadRequestException(`La DA n'est pas a l'etape ${docStep}`);
    }

    // Remplace le document précédent (1 seul par étape)
    await this.prisma.attachment.deleteMany({
      where: { purchaseId, type: cfg.type },
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        purchaseId,
        type: cfg.type,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        // Pour BR : on stocke la justification en description si fournie
        description: dto.justification
          ? `Justification incohérence BC: ${dto.justification}`
          : docStep === 'DAP'
            ? 'DAP'
            : undefined,
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
      message: `${cfg.label} uploade avec succes`,
    };
  }

  async get(docStep: DocStep, purchaseId: string) {
    const cfg = CFG[docStep];
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        attachments: {
          where: { type: cfg.type },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        // Pour INVOICE : inclure le BC en référence
        ...(docStep === 'INVOICE' && {
          attachments: {
            where: { type: { in: [cfg.type, AttachmentType.PURCHASE_ORDER] } },
            orderBy: { createdAt: 'desc' },
          },
        }),
      },
    });
    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");

    if (docStep === 'INVOICE') {
      const atts = purchase.attachments as any[];
      return {
        purchaseId,
        document: atts.find((a) => a.type === AttachmentType.INVOICE) ?? null,
        bcReference:
          atts.find((a) => a.type === AttachmentType.PURCHASE_ORDER) ?? null,
      };
    }

    return {
      purchaseId,
      document: purchase.attachments[0] ?? null,
    };
  }

  /** Délègue à SubmitService (gère déjà BR→INVOICE, INVOICE→workflow, etc.) */
  async submit(purchaseId: string, userId: number) {
    return this.submitService.submitForValidation(purchaseId, userId);
  }
}
