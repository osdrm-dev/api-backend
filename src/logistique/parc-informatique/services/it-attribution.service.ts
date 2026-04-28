import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ItAttributionRepository } from 'src/repository/parc-informatique/it-attribution.repository';
import { ItAssetRepository } from 'src/repository/parc-informatique/it-asset.repository';
import { CreateItAttributionDto } from '../dto/create-it-attribution.dto';
import { ReturnItAttributionDto } from '../dto/return-it-attribution.dto';
import { FilterItAttributionDto } from '../dto/filter-it-attribution.dto';
import { ItAttributionStatus } from '@prisma/client';

@Injectable()
export class ItAttributionService {
  constructor(
    private readonly repository: ItAttributionRepository,
    private readonly assetRepository: ItAssetRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateItAttributionDto) {
    const asset = await this.assetRepository.findById(dto.assetId);
    if (!asset || asset.archivedAt !== null) {
      throw new NotFoundException('Actif informatique introuvable.');
    }

    const stockDisponible = asset.quantiteTotal - asset.quantiteAttribuee;
    if (dto.quantity > stockDisponible) {
      throw new BadRequestException(
        `Stock insuffisant. Disponible : ${stockDisponible}, demandé : ${dto.quantity}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const attribution = await tx.itAttribution.create({
        data: {
          assetId: dto.assetId,
          beneficiaryId: dto.beneficiaryId,
          quantity: dto.quantity,
          attributedAt: dto.attributedAt
            ? new Date(dto.attributedAt)
            : new Date(),
          notes: dto.notes,
          demandId: dto.demandId,
        },
        include: {
          asset: { include: { category: true } },
          beneficiary: {
            select: { id: true, name: true, email: true, role: true },
          },
          demand: true,
        },
      });

      await tx.itAsset.update({
        where: { id: dto.assetId },
        data: { quantiteAttribuee: { increment: dto.quantity } },
      });

      return attribution;
    });
  }

  async findAll(query: FilterItAttributionDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { data, total } = await this.repository.findAll(
      {
        assetId: query.assetId,
        beneficiaryId: query.beneficiaryId,
        status: query.status,
        demandId: query.demandId,
      },
      { skip, take: limit },
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async return(id: string, dto: ReturnItAttributionDto) {
    const attribution = await this.repository.findById(id);
    if (!attribution) {
      throw new NotFoundException('Attribution introuvable.');
    }
    if (attribution.status === ItAttributionStatus.RETOURNE) {
      throw new ConflictException('Cet actif a déjà été retourné.');
    }

    return this.prisma.$transaction(async (tx) => {
      const returned = await tx.itAttribution.update({
        where: { id },
        data: {
          status: ItAttributionStatus.RETOURNE,
          returnedAt: dto.returnedAt ? new Date(dto.returnedAt) : new Date(),
          returnCondition: dto.returnCondition,
          notes: dto.notes,
        },
        include: {
          asset: { include: { category: true } },
          beneficiary: {
            select: { id: true, name: true, email: true, role: true },
          },
          demand: true,
        },
      });

      await tx.itAsset.update({
        where: { id: attribution.assetId },
        data: { quantiteAttribuee: { decrement: attribution.quantity } },
      });

      return returned;
    });
  }
}
