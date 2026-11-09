import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class EquipmentCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    description?: string;
    depreciationYears?: number;
    alertThreshold?: number;
  }) {
    return this.prisma.equipmentCategory.create({ data });
  }

  async findAll(includeInactive = false) {
    const where: Prisma.EquipmentCategoryWhereInput = includeInactive
      ? {}
      : { isActive: true };
    return this.prisma.equipmentCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.equipmentCategory.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      depreciationYears?: number;
      alertThreshold?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.equipmentCategory.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.equipmentCategory.delete({ where: { id } });
  }

  async hasActiveAssets(id: string): Promise<boolean> {
    const count = await this.prisma.equipment.count({
      where: { categoryId: id, archivedAt: null },
    });
    return count > 0;
  }
}
