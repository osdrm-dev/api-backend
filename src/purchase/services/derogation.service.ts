import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ValidateDerogationDto } from '../dto/derogation.dto';
import { DerogationStatus, PurchaseStatus } from '@prisma/client';
import {
  parsePaginationParams,
  buildPaginatedResponse,
  PaginationParams,
} from 'src/common/pagination.utils';

@Injectable()
export class DerogationService {
  constructor(private readonly prisma: PrismaService) {}

  async getDerogationById(derogationId: string) {
    const derogation = await this.prisma.derogation.findUnique({
      where: { id: derogationId },
      include: {
        purchase: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!derogation) {
      throw new NotFoundException('Derogation non trouvee');
    }

    return derogation;
  }

  async getPendingDerogations(userId: number, filters: PaginationParams = {}) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouve');
    }

    // Parser et valider les paramètres de pagination
    const pagination = parsePaginationParams(filters, {
      defaultPage: 1,
      defaultLimit: 10,
      maxLimit: 100,
    });

    const where: any = {
      status: DerogationStatus.PENDING,
    };

    const [derogations, total] = await Promise.all([
      this.prisma.derogation.findMany({
        where,
        include: {
          purchase: {
            include: {
              creator: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              attachments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.derogation.count({ where }),
    ]);

    return buildPaginatedResponse(derogations, total, pagination);
  }

  /**
   * Valider une derogation
   */
  async validateDerogation(
    derogationId: string,
    userId: number,
    validateDto: ValidateDerogationDto,
  ) {
    const derogation = await this.prisma.derogation.findUnique({
      where: { id: derogationId },
      include: {
        purchase: true,
      },
    });

    if (!derogation) {
      throw new NotFoundException('Derogation non trouvee');
    }

    if (derogation.status !== DerogationStatus.PENDING) {
      throw new BadRequestException('Cette derogation a deja ete traitee');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouve');
    }

    // Mettre a jour la derogation
    const updatedDerogation = await this.prisma.derogation.update({
      where: { id: derogationId },
      data: {
        status: validateDto.approved
          ? DerogationStatus.VALIDATED
          : DerogationStatus.REJECTED,
        approvedBy: validateDto.approved ? user.name : null,
        approvedAt: validateDto.approved ? new Date() : null,
        rejectedBy: !validateDto.approved ? user.name : null,
        rejectedAt: !validateDto.approved ? new Date() : null,
        comments: validateDto.comments,
      },
    });

    // Mettre a jour le statut de la purchase
    if (validateDto.approved) {
      await this.prisma.purchase.update({
        where: { id: derogation.purchaseId },
        data: {
          status: PurchaseStatus.PUBLISHED,
        },
      });
    } else {
      await this.prisma.purchase.update({
        where: { id: derogation.purchaseId },
        data: {
          status: PurchaseStatus.REJECTED,
          observations: `Derogation rejetee: ${validateDto.comments}`,
          closedAt: new Date(),
        },
      });
    }

    return {
      id: updatedDerogation.id,
      status: updatedDerogation.status,
      message: validateDto.approved
        ? 'Derogation approuvee avec succes'
        : 'Derogation rejetee',
    };
  }

  /**
   * Recuperer l'historique des derogations
   */
  async getDerogationHistory(userId: number, filters: PaginationParams = {}) {
    // Parser et valider les paramètres de pagination
    const pagination = parsePaginationParams(filters, {
      defaultPage: 1,
      defaultLimit: 10,
      maxLimit: 100,
    });

    const [derogations, total] = await Promise.all([
      this.prisma.derogation.findMany({
        where: {
          status: {
            in: [DerogationStatus.VALIDATED, DerogationStatus.REJECTED],
          },
        },
        include: {
          purchase: {
            include: {
              creator: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: [{ approvedAt: 'desc' }, { rejectedAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.derogation.count({
        where: {
          status: {
            in: [DerogationStatus.VALIDATED, DerogationStatus.REJECTED],
          },
        },
      }),
    ]);

    return buildPaginatedResponse(derogations, total, pagination);
  }
}
