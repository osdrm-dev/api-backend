import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PV, Prisma, PVStatus } from '@prisma/client';

type PVWithRelations = PV & {
  suppliers: any[];
};

@Injectable()
export class PVRepository {
  constructor(private prisma: PrismaService) {}

  private readonly standardInclude: Prisma.PVInclude = {
    suppliers: {
      include: { items: true },
      orderBy: { order: 'asc' },
    },
  };

  async findByPurchaseId(purchaseId: string): Promise<PVWithRelations | null> {
    return this.prisma.pV.findUnique({
      where: { purchaseId },
      include: this.standardInclude,
    }) as Promise<PVWithRelations | null>;
  }

  async findById(id: string): Promise<PVWithRelations | null> {
    return this.prisma.pV.findUnique({
      where: { id },
      include: this.standardInclude,
    }) as Promise<PVWithRelations | null>;
  }

  async create(data: Prisma.PVCreateInput): Promise<PVWithRelations> {
    return this.prisma.pV.create({
      data,
      include: this.standardInclude,
    }) as Promise<PVWithRelations>;
  }

  async update(params: {
    where: Prisma.PVWhereUniqueInput;
    data: Prisma.PVUpdateInput;
  }): Promise<PVWithRelations> {
    const { where, data } = params;
    return this.prisma.pV.update({
      where,
      data,
      include: this.standardInclude,
    }) as Promise<PVWithRelations>;
  }

  async updateStatus(params: {
    id: string;
    status: PVStatus;
  }): Promise<PVWithRelations> {
    const { id, status } = params;
    return this.update({
      where: { id },
      data: { status },
    });
  }

  async deleteSuppliersById(pvId: string): Promise<void> {
    await this.prisma.pVSupplier.deleteMany({
      where: { pvId },
    });
  }
}
