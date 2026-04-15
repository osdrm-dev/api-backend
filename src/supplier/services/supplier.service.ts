import { Injectable } from '@nestjs/common';
import { SupplierActiveStatus } from '@prisma/client';
import { SupplierRepository } from 'src/repository/supplier/supplier.repository';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private readonly repository: SupplierRepository) {}

  async create(dto: CreateSupplierDto) {
    return this.repository.create(dto);
  }

  async findAll(filters: any) {
    return this.repository.findAll(filters);
  }

  async findOne(id: string) {
    return this.repository.findOne(id);
  }

  async update(id: string, dto: UpdateSupplierDto) {
    return this.repository.update(id, dto);
  }

  async setStatus(id: string, activeStatus: SupplierActiveStatus) {
    return this.repository.setStatus(id, activeStatus);
  }
}
