import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowService } from './workflow.service';
import { WorkflowConfigService } from '../../purchaseValidation/services/workflow-config.service';
import { UploadQuoteDto } from '../dto/quotation.dto';
import { CreateDerogationDto } from '../dto/derogation.dto';
import {
  PurchaseStatus,
  PurchaseStep,
  AttachmentType,
  DerogationStatus,
} from '@prisma/client';
import { assertIsOwningBuyer } from '../../utils/purchase-guards';
import { AppException, ErrorCode } from 'src/common/errors';

@Injectable()
export class QuotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
    private readonly workflowConfig: WorkflowConfigService,
  ) {}

  private async assertAcheteur(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ACHETEUR') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_BUYER_ONLY,
        'Only a buyer can perform this action',
      );
    }
  }

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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
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
    await this.assertAcheteur(userId);

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

    assertIsOwningBuyer(purchase, userId);

    if (purchase.currentStep !== PurchaseStep.QR) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_INVALID_STEP,
        'Purchase is not at step QR',
        { params: { step: 'QR' } },
      );
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        purchaseId,
        type: AttachmentType.QUOTE,
        fileName: quoteDto.fileName,
        fileUrl: quoteDto.fileUrl,
        fileId: quoteDto.fileId,
        fileSize: quoteDto.fileSize,
        mimeType: quoteDto.mimeType,
        description: quoteDto.description,
        uploadedBy: userName,
      },
    });

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
    await this.assertAcheteur(userId);

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

    assertIsOwningBuyer(purchase, userId);

    if (purchase.currentStep !== PurchaseStep.QR) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_INVALID_STEP,
        'Purchase is not at step QR',
        { params: { step: 'QR' } },
      );
    }

    const attachments = await this.prisma.attachment.createMany({
      data: quoteDtos.map((dto) => ({
        purchaseId,
        type: AttachmentType.QUOTE,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileId: dto.fileId,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        description: dto.description,
        uploadedBy: userName,
      })),
    });

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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
    }

    return {
      purchaseId: purchase.id,
      quotes: purchase.attachments,
      total: purchase.attachments.length,
      derogation: purchase.derogation,
    };
  }

  async deleteQuote(purchaseId: string, quoteId: string, userId: number) {
    await this.assertAcheteur(userId);

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

    const quote = await this.prisma.attachment.findUnique({
      where: { id: quoteId },
    });

    if (!quote || quote.purchaseId !== purchaseId) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Quotation not found',
      );
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
    await this.assertAcheteur(userId);

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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
    }

    if (purchase.currentStep !== PurchaseStep.QR) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_INVALID_STEP,
        'Purchase is not at step QR',
        { params: { step: 'QR' } },
      );
    }

    if (purchase.derogation) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_DEROGATION_ALREADY_EXISTS,
        'A derogation already exists for this purchase',
      );
    }

    const amount = purchase.items.reduce((sum, item) => sum + item.amount, 0);
    const level = this.workflowService.getQuoteLevel(amount);
    const required = this.workflowService.getRequiredQuotesCount(level);

    if (purchase.attachments.length >= required) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_QUOTES_SUFFICIENT,
        'Enough quotations were already uploaded',
      );
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
    await this.assertAcheteur(userId);

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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
    }

    if (purchase.currentStep !== PurchaseStep.QR) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_INVALID_STEP,
        'Purchase is not at step QR',
        { params: { step: 'QR' } },
      );
    }

    const amount = purchase.items.reduce((sum, item) => sum + item.amount, 0);
    const level = this.workflowService.getQuoteLevel(amount);
    const required = this.workflowService.getRequiredQuotesCount(level);
    const uploaded = purchase.attachments.length;

    const hasEnoughQuotes = uploaded >= required;
    const hasApprovedDerogation =
      purchase.derogation?.status === DerogationStatus.VALIDATED;

    if (!hasEnoughQuotes && !hasApprovedDerogation) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_QUOTES_INSUFFICIENT,
        'Not enough quotations; upload more or request a derogation',
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Purchase not found',
      );
    }

    assertIsOwningBuyer(purchase, userId);

    if (purchase.currentStep !== PurchaseStep.QR) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_INVALID_STEP,
        'Purchase is not at step QR',
        { params: { step: 'QR' } },
      );
    }

    if (
      purchase.status !== PurchaseStatus.PUBLISHED &&
      purchase.status !== PurchaseStatus.AWAITING_DOCUMENTS
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_INVALID_STATUS,
        'Purchase must be PUBLISHED or AWAITING_DOCUMENTS',
        { params: { expected: 'PUBLISHED, AWAITING_DOCUMENTS' } },
      );
    }

    const amount = purchase.items.reduce((sum, item) => sum + item.amount, 0);
    const level = this.workflowService.getQuoteLevel(amount);
    const required = this.workflowService.getRequiredQuotesCount(level);
    const uploaded = purchase.attachments.length;

    const hasEnoughQuotes = uploaded >= required;

    // if (!hasEnoughQuotes && !useDerogation) {
    //   throw new AppException(
    //     `Devis insuffisants (${uploaded}/${required}). Cochez la case dérogation pour continuer malgré le manque de devis.`,
    //   );
    // }

    if (useDerogation && !derogationJustification?.trim()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_DEROGATION_JUSTIFICATION_REQUIRED,
        'A justification is required to use the derogation',
        {
          fields: [
            {
              field: 'derogationJustification',
              code: ErrorCode.PURCHASE_DEROGATION_JUSTIFICATION_REQUIRED,
            },
          ],
        },
      );
    }

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
    const requiredRoles = this.workflowConfig.getRequireValidators(
      PurchaseStep.QR,
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

    let newStatus: PurchaseStatus;
    if (useDerogation && !hasEnoughQuotes) {
      newStatus = PurchaseStatus.IN_DEROGATION;
    } else {
      newStatus = PurchaseStatus.PENDING_APPROVAL;
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
