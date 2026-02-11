import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PurchaseValidationModule } from '../purchaseValidation/purchase.module';

import { PurchaseController } from './controllers/purchase.controller';
import { QuotationController } from './controllers/quotation.controller';
import { DerogationController } from './controllers/derogation.controller';

import { PurchaseService } from './services/purchase.service';
import { QuotationService } from './services/quotation.service';
import { DerogationService } from './services/derogation.service';
import { WorkflowService } from './services/workflow.service';

@Module({
  imports: [PrismaModule, PurchaseValidationModule],
  controllers: [PurchaseController, QuotationController, DerogationController],
  providers: [
    PurchaseService,
    QuotationService,
    DerogationService,
    WorkflowService,
  ],
  exports: [
    PurchaseService,
    QuotationService,
    DerogationService,
    WorkflowService,
  ],
})
export class PurchaseModule {}
