import { Injectable } from '@nestjs/common';
import { Supplier } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { CreateSupplierDto } from 'src/supplier/dto/create-supplier.dto';
import { UpdateSupplierDto } from 'src/supplier/dto/update-supplier.dto';

@Injectable()
export class SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSupplierDto): Promise<Supplier> {
    return this.prisma.supplier.create({ data });
  }

  async findAll(filters: any): Promise<Supplier[]> {
    const where: any = {};

    if (filters.active !== undefined) {
      where.active = filters.active === 'true'; // conversion string → boolean
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.region) {
      where.region = filters.region;
    }

    if (filters.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }

    return this.prisma.supplier.findMany({ where });
  }

  async findOne(id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateSupplierDto): Promise<Supplier> {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  async setActive(id: string, active: boolean): Promise<Supplier> {
    return this.prisma.supplier.update({ where: { id }, data: { active } });
  }
}
