import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { SupplierService } from './services/supplier.service';
import { SupplierImportService } from './services/supplier-import.service';
import { SupplierController } from './controllers/supplier.controller';
import { SupplierRepository } from 'src/repository/supplier/supplier.repository';

@Module({
  imports: [PrismaModule],
  controllers: [SupplierController],
  providers: [SupplierService, SupplierImportService, SupplierRepository],
  exports: [SupplierService, SupplierRepository],
})
export class SupplierModule {}
