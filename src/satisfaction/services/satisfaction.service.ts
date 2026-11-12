import { Injectable, HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSatisfactionDto } from '../dto/create-satisfaction.dto';
import { FilterSatisfactionDto } from '../dto/filter-satisfaction.dto';

@Injectable()
export class SatisfactionService {
  constructor(private prisma: PrismaService) {}

  async create(purchaseId: string, dto: CreateSatisfactionDto) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Purchase ${purchaseId} not found`,
      );
    }

    if (purchase.status !== 'VALIDATED' && purchase.currentStep !== 'DONE') {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.SATISFACTION_PURCHASE_NOT_COMPLETED,
        'Purchase must be completed to submit a survey',
      );
    }

    const existing = await this.prisma.satisfactionSurvey.findUnique({
      where: { purchaseId },
    });

    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.SATISFACTION_ALREADY_EXISTS,
        'A survey already exists for this purchase',
      );
    }

    // Vérifier que les fichiers existent si fournis
    if (dto.fileIds && dto.fileIds.length > 0) {
      const files = await this.prisma.file.findMany({
        where: { id: { in: dto.fileIds } },
      });

      if (files.length !== dto.fileIds.length) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.SATISFACTION_FILES_NOT_FOUND,
          'One or more files were not found',
          {
            fields: [
              {
                field: 'fileIds',
                code: ErrorCode.SATISFACTION_FILES_NOT_FOUND,
              },
            ],
          },
        );
      }
    }

    const { fileIds, ...surveyData } = dto;

    return this.prisma.satisfactionSurvey
      .create({
        data: {
          purchaseId,
          ...surveyData,
        },
        include: {
          purchase: {
            select: {
              reference: true,
              title: true,
            },
          },
        },
      })
      .then(async (survey) => {
        // Créer les attachments après la création du survey
        if (fileIds && fileIds.length > 0) {
          // Récupérer les infos des fichiers
          const files = await this.prisma.file.findMany({
            where: { id: { in: fileIds } },
          });

          // Créer les attachments avec les infos complètes
          await this.prisma.attachment.createMany({
            data: files.map((file) => ({
              purchaseId,
              fileId: file.id,
              type: 'SATISFACTION_SURVEY',
              fileName: file.originalName,
              fileUrl: file.url,
              fileSize: file.size,
              mimeType: file.mimeType,
            })),
          });
        }

        return survey;
      });
  }

  async findByPurchase(purchaseId: string) {
    return this.prisma.satisfactionSurvey.findUnique({
      where: { purchaseId },
      include: {
        purchase: {
          select: {
            reference: true,
            title: true,
          },
        },
      },
    });
  }

  async findAll(filters: FilterSatisfactionDto = {}) {
    const purchaseWhere: Prisma.PurchaseWhereInput = {};

    if (filters.startDate || filters.endDate) {
      purchaseWhere.createdAt = {
        ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
      };
    }

    if (filters.marketType) {
      purchaseWhere.marketType = filters.marketType;
    }

    if (filters.operationType) {
      purchaseWhere.operationType = filters.operationType;
    }

    if (filters.supplierId) {
      purchaseWhere.pv = {
        suppliers: {
          some: {
            supplierId: filters.supplierId,
            rang: 1,
          },
        },
      };
    }

    if (filters.purchaseId) {
      purchaseWhere.id = filters.purchaseId;
    }

    const surveys = await this.prisma.satisfactionSurvey.findMany({
      where:
        Object.keys(purchaseWhere).length > 0
          ? { purchase: purchaseWhere }
          : undefined,
      include: {
        purchase: {
          select: {
            reference: true,
            title: true,
            marketType: true,
            operationType: true,
            createdAt: true,
            status: true,
            pv: {
              include: {
                suppliers: {
                  where: { rang: 1 },
                  take: 1,
                  include: {
                    supplier: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return surveys.map((survey) => {
      const retainedPvSupplier = survey.purchase.pv?.suppliers?.[0];
      const { reference, title, marketType, operationType, createdAt, status } =
        survey.purchase;
      return {
        ...survey,
        purchase: {
          reference,
          title,
          marketType,
          operationType,
          createdAt,
          status,
        },
        supplier: retainedPvSupplier?.supplier ?? null,
      };
    });
  }

  async findById(id: string) {
    const survey = await this.prisma.satisfactionSurvey.findUnique({
      where: { id },
      include: {
        purchase: {
          select: {
            reference: true,
            title: true,
            marketType: true,
            operationType: true,
            status: true,
            createdAt: true,
            pv: {
              include: {
                suppliers: {
                  where: { rang: 1 },
                  take: 1,
                  include: {
                    supplier: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!survey) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Satisfaction survey not found',
      );
    }

    const retainedPvSupplier = survey.purchase.pv?.suppliers?.[0];
    const { reference, title, marketType, operationType, status, createdAt } =
      survey.purchase;
    return {
      ...survey,
      purchase: {
        reference,
        title,
        marketType,
        operationType,
        status,
        createdAt,
      },
      supplier: retainedPvSupplier?.supplier ?? null,
    };
  }

  async getStatistics() {
    const surveys = await this.prisma.satisfactionSurvey.findMany();

    if (surveys.length === 0) {
      return {
        total: 0,
        averageRating: 0,
        averageDeliveryRating: 0,
        averageQualityRating: 0,
        averageServiceRating: 0,
      };
    }

    const total = surveys.length;
    const avgRating = surveys.reduce((sum, s) => sum + s.rating, 0) / total;
    const avgDelivery =
      surveys
        .filter((s) => s.deliveryRating)
        .reduce((sum, s) => sum + (s.deliveryRating || 0), 0) /
        surveys.filter((s) => s.deliveryRating).length || 0;
    const avgQuality =
      surveys
        .filter((s) => s.qualityRating)
        .reduce((sum, s) => sum + (s.qualityRating || 0), 0) /
        surveys.filter((s) => s.qualityRating).length || 0;
    const avgService =
      surveys
        .filter((s) => s.serviceRating)
        .reduce((sum, s) => sum + (s.serviceRating || 0), 0) /
        surveys.filter((s) => s.serviceRating).length || 0;

    return {
      total,
      averageRating: Math.round(avgRating * 100) / 100,
      averageDeliveryRating: Math.round(avgDelivery * 100) / 100,
      averageQualityRating: Math.round(avgQuality * 100) / 100,
      averageServiceRating: Math.round(avgService * 100) / 100,
    };
  }
}
