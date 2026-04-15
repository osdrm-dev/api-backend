import { Injectable } from '@nestjs/common';
import { Supplier, SupplierActiveStatus } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { CreateSupplierDto } from 'src/supplier/dto/create-supplier.dto';
import { UpdateSupplierDto } from 'src/supplier/dto/update-supplier.dto';

@Injectable()
export class SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSupplierDto): Promise<Supplier> {
    return this.prisma.supplier.create({ data });
  }

  async findAll(filters: any) {
    const { status, region, activeStatus, skip = 0, take = 10 } = filters;

    const where: any = {};

    if (status && status !== 'ALL') where.status = status;
    if (region && region !== 'ALL') where.region = region;
    if (activeStatus && activeStatus !== 'ALL')
      where.activeStatus = activeStatus;
    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page: Math.floor(Number(skip) / Number(take)) + 1,
        limit: Number(take),
        totalPages: Math.ceil(total / Number(take)),
      },
    };
  }

  async findOne(id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateSupplierDto): Promise<Supplier> {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  async setStatus(
    id: string,
    activeStatus: SupplierActiveStatus,
  ): Promise<Supplier> {
    return this.prisma.supplier.update({
      where: { id },
      data: { activeStatus },
    });
  }
}
