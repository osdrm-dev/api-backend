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

  async getQuoteLevelInfo(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: true,
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

    const amount = purchase.items.reduce((sum, item) => sum + item.amount, 0);
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

  async uploadQuote(
    purchaseId: string,
    userId: number,
    userName: string,
    quoteDto: UploadQuoteDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ACHETEUR') {
      throw new ForbiddenException('Seul un acheteur peut uploader des devis');
    }

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
        uploadedBy: userName,
      },
    });

    // Passer en AWAITING_DOCUMENTS pendant l'ajout des devis
    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: PurchaseStatus.AWAITING_DOCUMENTS },
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      message: 'Devis telecharge avec succes',
    };
  }

  async uploadMultipleQuotes(
    purchaseId: string,
    userId: number,
    userName: string,
    quoteDtos: UploadQuoteDto[],
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ACHETEUR') {
      throw new ForbiddenException('Seul un acheteur peut uploader des devis');
    }

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
        uploadedBy: userName,
      })),
    });

    // Passer en AWAITING_DOCUMENTS pendant l'ajout des devis
    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: PurchaseStatus.AWAITING_DOCUMENTS },
    });

    return {
      count: attachments.count,
      message: `${attachments.count} devis telecharges avec succes`,
    };
  }

  async listQuotes(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        attachments: {
          where: { type: AttachmentType.QUOTE },
          orderBy: { createdAt: 'desc' },
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

    return {
      purchaseId: purchase.id,
      quotes: purchase.attachments,
      total: purchase.attachments.length,
      derogation: purchase.derogation,
    };
  }

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

  async requestQuoteDerogation(
    purchaseId: string,
    userId: number,
    derogationDto: CreateDerogationDto,
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: true,
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

    const amount = purchase.items.reduce((sum, item) => sum + item.amount, 0);
    const level = this.workflowService.getQuoteLevel(amount);
    const required = this.workflowService.getRequiredQuotesCount(level);

    if (purchase.attachments.length >= required) {
      throw new BadRequestException('Vous avez deja suffisamment de devis');
    }

    const derogation = await this.prisma.derogation.create({
      data: {
        purchaseId,
        reason: derogationDto.reason,
        justification: derogationDto.justification,
        status: DerogationStatus.PENDING,
      },
    });

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

  async validateQuotesAndProceed(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: true,
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

    const amount = purchase.items.reduce((sum, item) => sum + item.amount, 0);
    const level = this.workflowService.getQuoteLevel(amount);
    const required = this.workflowService.getRequiredQuotesCount(level);
    const uploaded = purchase.attachments.length;

    const hasEnoughQuotes = uploaded >= required;
    const hasApprovedDerogation =
      purchase.derogation?.status === DerogationStatus.VALIDATED;

    if (!hasEnoughQuotes && !hasApprovedDerogation) {
      throw new BadRequestException(
        'Devis insuffisants. Veuillez uploader plus de devis ou demander une derogation.',
      );
    }

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

  async submitQuotesForValidation(
    purchaseId: string,
    userId: number,
    useDerogation: boolean = false,
    derogationJustification?: string,
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: true,
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

    if (
      purchase.status !== PurchaseStatus.PUBLISHED &&
      purchase.status !== PurchaseStatus.AWAITING_DOCUMENTS
    ) {
      throw new BadRequestException(
        'La DA doit etre en cours de validation ou en preparation pour soumettre les devis',
      );
    }

    const amount = purchase.items.reduce((sum, item) => sum + item.amount, 0);
    const level = this.workflowService.getQuoteLevel(amount);
    const required = this.workflowService.getRequiredQuotesCount(level);
    const uploaded = purchase.attachments.length;

    const hasEnoughQuotes = uploaded >= required;

    if (!hasEnoughQuotes && !useDerogation) {
      throw new BadRequestException(
        `Devis insuffisants (${uploaded}/${required}). Cochez la case dérogation pour continuer malgré le manque de devis.`,
      );
    }

    if (useDerogation && !derogationJustification?.trim()) {
      throw new BadRequestException(
        'Une justification est obligatoire pour utiliser la dérogation.',
      );
    }

    // Créer une dérogation si nécessaire
    if (useDerogation && !hasEnoughQuotes) {
      await this.prisma.derogation.create({
        data: {
          purchaseId,
          reason: 'Nombre de devis insuffisant',
          justification: derogationJustification ?? '',
          status: DerogationStatus.VALIDATED,
        },
      });
    }

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

    // Déterminer le status selon les devis
    let newStatus: PurchaseStatus;
    if (useDerogation && !hasEnoughQuotes) {
      newStatus = PurchaseStatus.IN_DEROGATION;
    } else if (hasEnoughQuotes) {
      newStatus = PurchaseStatus.PENDING_APPROVAL; // Devis complets, en attente de validation
    } else {
      newStatus = PurchaseStatus.PUBLISHED;
    }

    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: newStatus },
    });

    return {
      id: purchase.id,
      reference: purchase.reference,
      status: newStatus,
      currentStep: PurchaseStep.QR,
      workflow: workflow.validators,
      message: useDerogation
        ? 'Devis soumis pour validation QR avec dérogation.'
        : hasEnoughQuotes
          ? 'Devis complets soumis pour validation QR.'
          : 'Devis soumis pour validation QR.',
    };
  }
}
