import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ItCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    description?: string;
    depreciationYears?: number;
  }) {
    return this.prisma.itCategory.create({ data });
  }

  async findAll(includeInactive = false) {
    const where: Prisma.ItCategoryWhereInput = includeInactive
      ? {}
      : { isActive: true };
    return this.prisma.itCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.itCategory.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      depreciationYears?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.itCategory.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.itCategory.delete({ where: { id } });
  }

  async hasActiveAssets(id: string): Promise<boolean> {
    const count = await this.prisma.itAsset.count({
      where: { categoryId: id, archivedAt: null },
    });
    return count > 0;
  }
}
