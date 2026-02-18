import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowService } from './workflow.service';
import { UploadQuoteDto } from '../dto/quotation.dto';
import { CreateDerogationDto } from '../dto/derogation.dto';
import {
  PurchaseStatus,
  PurchaseStep,
  AttachmentType,
  DerogationStatus,
} from '@prisma/client';

@Injectable()
export class QuotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
  ) {}

  /**
   * Recuperer les informations de niveau de devis pour une DA
   */
  async getQuoteLevelInfo(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        attachments: {
          where: { type: AttachmentType.QUOTE },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.creatorId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    const amount = Number(purchase.amount);
    const level = this.workflowService.getQuoteLevel(amount);
    const levelInfo = this.workflowService.getQuoteLevelInfo(level);

    const uploadedQuotes = purchase.attachments.length;
    const requiredQuotes = levelInfo.requiredQuotes;

    return {
      purchaseId: purchase.id,
      reference: purchase.reference,
      amount,
      level: levelInfo.level,
      levelLabel: levelInfo.label,
      description: levelInfo.description,
      requiredQuotes,
      uploadedQuotes,
      canProceed: uploadedQuotes >= requiredQuotes,
      needsDerogation: uploadedQuotes < requiredQuotes,
    };
  }

  /**
   * Upload un devis
   */
  async uploadQuote(
    purchaseId: string,
    userId: number,
    quoteDto: UploadQuoteDto,
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.currentStep !== PurchaseStep.QR) {
      throw new BadRequestException("Cette DA n'est pas a l'etape QR");
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        purchaseId,
        type: AttachmentType.QUOTE,
        fileName: quoteDto.fileName,
        fileUrl: quoteDto.fileUrl,
        fileSize: quoteDto.fileSize,
        mimeType: quoteDto.mimeType,
        description: quoteDto.description,
        uploadedBy: quoteDto.uploadedBy,
      },
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      message: 'Devis telecharge avec succes',
    };
  }

  /**
   * Upload plusieurs devis en une seule fois
   */
  async uploadMultipleQuotes(
    purchaseId: string,
    userId: number,
    quoteDtos: UploadQuoteDto[],
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.currentStep !== PurchaseStep.QR) {
      throw new BadRequestException("Cette DA n'est pas a l'etape QR");
    }

    const attachments = await this.prisma.attachment.createMany({
      data: quoteDtos.map((dto) => ({
        purchaseId,
        type: AttachmentType.QUOTE,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        description: dto.description,
        uploadedBy: dto.uploadedBy,
      })),
    });

    return {
      count: attachments.count,
      message: `${attachments.count} devis telecharges avec succes`,
    };
  }

  /**
   * Lister les devis d'une DA
   */
  async listQuotes(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        attachments: {
          where: { type: AttachmentType.QUOTE },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.creatorId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    return {
      purchaseId: purchase.id,
      quotes: purchase.attachments,
      total: purchase.attachments.length,
    };
  }

  /**
   * Supprimer un devis
   */
  async deleteQuote(purchaseId: string, quoteId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.creatorId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    const quote = await this.prisma.attachment.findUnique({
      where: { id: quoteId },
    });

    if (!quote || quote.purchaseId !== purchaseId) {
      throw new NotFoundException('Devis non trouve');
    }

    await this.prisma.attachment.delete({
      where: { id: quoteId },
    });

    return {
      message: 'Devis supprime avec succes',
    };
  }

  /**
   * Demander une derogation pour devis insuffisants
   */
  async requestQuoteDerogation(
    purchaseId: string,
    userId: number,
    derogationDto: CreateDerogationDto,
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        attachments: {
          where: { type: AttachmentType.QUOTE },
        },
        derogation: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.creatorId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    if (purchase.currentStep !== PurchaseStep.QR) {
      throw new BadRequestException("Cette DA n'est pas a l'etape QR");
    }

    if (purchase.derogation) {
      throw new BadRequestException('Une derogation existe deja pour cette DA');
    }

    // Verifier que les devis sont insuffisants
    const amount = Number(purchase.amount);
    const level = this.workflowService.getQuoteLevel(amount);
    const required = this.workflowService.getRequiredQuotesCount(level);

    if (purchase.attachments.length >= required) {
      throw new BadRequestException('Vous avez deja suffisamment de devis');
    }

    // Creer la derogation
    const derogation = await this.prisma.derogation.create({
      data: {
        purchaseId,
        reason: derogationDto.reason,
        justification: derogationDto.justification,
        status: DerogationStatus.PENDING,
      },
    });

    // Mettre a jour le statut de la purchase
    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        status: PurchaseStatus.IN_DEROGATION,
      },
    });

    return {
      id: derogation.id,
      purchaseId,
      status: DerogationStatus.PENDING,
      message: 'Demande de derogation soumise avec succes',
    };
  }

  /**
   * Valider les devis et passer a l'etape suivante
   */
  async validateQuotesAndProceed(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        attachments: {
          where: { type: AttachmentType.QUOTE },
        },
        derogation: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.creatorId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }

    if (purchase.currentStep !== PurchaseStep.QR) {
      throw new BadRequestException("Cette DA n'est pas a l'etape QR");
    }

    const amount = Number(purchase.amount);
    const level = this.workflowService.getQuoteLevel(amount);
    const required = this.workflowService.getRequiredQuotesCount(level);
    const uploaded = purchase.attachments.length;

    // Verifier si on a assez de devis ou une derogation validee
    const hasEnoughQuotes = uploaded >= required;
    const hasApprovedDerogation =
      purchase.derogation?.status === DerogationStatus.VALIDATED;

    if (!hasEnoughQuotes && !hasApprovedDerogation) {
      throw new BadRequestException(
        'Devis insuffisants. Veuillez uploader plus de devis ou demander une derogation.',
      );
    }

    // Passer a l'etape suivante (PV ou selon workflow)
    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        currentStep: PurchaseStep.PV,
        status: PurchaseStatus.VALIDATED,
      },
    });

    return {
      id: purchaseId,
      currentStep: PurchaseStep.PV,
      message: "Devis valides. Passage a l'etape suivante.",
    };
  }

  /**
   * PHASE A -> PHASE B: Soumettre les devis pour validation
   */
  async submitQuotesForValidation(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        attachments: {
          where: { type: AttachmentType.QUOTE },
        },
        derogation: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException("Demande d'achat non trouvee");
    }

    if (purchase.currentStep !== PurchaseStep.QR) {
      throw new BadRequestException("Cette DA n'est pas a l'etape QR");
    }

    if (purchase.status !== PurchaseStatus.VALIDATED) {
      throw new BadRequestException(
        'La DA doit etre validee (etape DA) avant de soumettre les devis',
      );
    }

    const amount = Number(purchase.amount);
    const level = this.workflowService.getQuoteLevel(amount);
    const required = this.workflowService.getRequiredQuotesCount(level);
    const uploaded = purchase.attachments.length;

    // Verifier devis ou derogation
    const hasEnoughQuotes = uploaded >= required;
    const hasDerogation = !!purchase.derogation;

    if (!hasEnoughQuotes && !hasDerogation) {
      throw new BadRequestException(
        `Devis insuffisants (${uploaded}/${required}). Uploadez plus de devis ou demandez une derogation.`,
      );
    }

    // Creer workflow QR selon operationType
    const requiredRoles = this.workflowService.getQRValidators(
      purchase.operationType,
      amount,
    );

    const workflow = await this.prisma.validationWorkflow.create({
      data: {
        purchaseId,
        step: PurchaseStep.QR,
        currentStep: 0,
        validators: {
          create: requiredRoles.map((role, index) => ({
            role,
            order: index,
            userId: null,
            name: null,
            email: null,
            isValidated: false,
            validatedAt: null,
            decision: null,
          })),
        },
      },
      include: {
        validators: {
          orderBy: { order: 'asc' },
        },
      },
    });

    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        status: PurchaseStatus.PUBLISHED,
      },
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: PurchaseStatus.PUBLISHED,
      currentStep: PurchaseStep.QR,
      workflow: workflow.validators,
      message: 'Devis soumis pour validation.',
    };
  }
}
