import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { PrismaService } from 'prisma/prisma.service';
import { EquipmentAttributionRepository } from 'src/repository/inventory/equipment-attribution.repository';
import { EquipmentRepository } from 'src/repository/inventory/equipment.repository';
import { CreateEquipmentAttributionDto } from '../dto/create-equipment-attribution.dto';
import { ReturnEquipmentAttributionDto } from '../dto/return-equipment-attribution.dto';
import { FilterEquipmentAttributionDto } from '../dto/filter-equipment-attribution.dto';
import { EquipmentAttributionStatus } from '@prisma/client';
import { isAttributed, isBroken } from '../utils/equipment-stock.util';
import { groupAttributionsByHolder } from '../utils/equipment-holders.util';
import { FilterEquipmentHoldersDto } from '../dto/filter-equipment-holders.dto';

@Injectable()
export class EquipmentAttributionService {
  constructor(
    private readonly repository: EquipmentAttributionRepository,
    private readonly assetRepository: EquipmentRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateEquipmentAttributionDto) {
    const asset = await this.assetRepository.findById(dto.assetId);
    if (!asset || asset.archivedAt !== null) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment not found',
      );
    }
    if (isAttributed(asset)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.EQUIPMENT_ALREADY_ATTRIBUTED,
        'Equipment is already attributed',
      );
    }
    if (isBroken(asset)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.EQUIPMENT_BROKEN,
        'Equipment is broken or out of service',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Re-vérifié dans une transaction Serializable : deux attributions
          // concurrentes ne peuvent pas rester ACTIVE sur le même matériel.
          const active = await tx.equipmentAttribution.count({
            where: {
              assetId: dto.assetId,
              status: EquipmentAttributionStatus.ACTIVE,
            },
          });
          if (active > 0) {
            throw new AppException(
              HttpStatus.BAD_REQUEST,
              ErrorCode.EQUIPMENT_ALREADY_ATTRIBUTED,
              'Equipment is already attributed',
            );
          }
          return tx.equipmentAttribution.create({
            data: {
              assetId: dto.assetId,
              beneficiaryId: dto.beneficiaryId,
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
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (e: any) {
      if (e?.code === 'P2034') {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.EQUIPMENT_ATTRIBUTION_CONCURRENT,
          'Another attribution was just recorded',
        );
      }
      throw e;
    }
  }

  async findAll(query: FilterEquipmentAttributionDto) {
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

  async findHolders(query: FilterEquipmentHoldersDto) {
    const rows = await this.repository.findActiveForHolders(query.search);
    return groupAttributionsByHolder(rows, query.categoryId);
  }

  async return(id: string, dto: ReturnEquipmentAttributionDto) {
    const attribution = await this.repository.findById(id);
    if (!attribution) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Attribution not found',
      );
    }
    if (attribution.status === EquipmentAttributionStatus.RETOURNE) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.EQUIPMENT_ALREADY_RETURNED,
        'Asset was already returned',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const returned = await tx.equipmentAttribution.update({
        where: { id },
        data: {
          status: EquipmentAttributionStatus.RETOURNE,
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

      await tx.equipment.update({
        where: { id: attribution.assetId },
        data: { status: dto.returnCondition },
      });

      return returned;
    });
  }
}
