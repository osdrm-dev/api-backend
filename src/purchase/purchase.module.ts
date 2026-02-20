import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PurchaseValidationModule } from '../purchaseValidation/purchase.module';

import { PurchaseController } from './controllers/purchase.controller';
import { QuotationController } from './controllers/quotation.controller';
import { DerogationController } from './controllers/derogation.controller';
import { AcheteurController } from './controllers/acheteur.controller';

import { PurchaseService } from './services/purchase.service';
import { QuotationService } from './services/quotation.service';
import { DerogationService } from './services/derogation.service';
import { WorkflowService } from './services/workflow.service';
import { PurchaseAttachmentBcController } from './controllers/purchase-attachment-bc.controller';
import { PurchaseAttachmentBcService } from './services/purchase-attachment-bc.service';

@Module({
  imports: [PrismaModule, PurchaseValidationModule],
  controllers: [
    PurchaseController,
    QuotationController,
    DerogationController,
    AcheteurController,
    PurchaseAttachmentBcController,
  ],
  providers: [
    PurchaseService,
    QuotationService,
    DerogationService,
    WorkflowService,
    PurchaseAttachmentBcService,
  ],
  exports: [
    PurchaseService,
    QuotationService,
    DerogationService,
    WorkflowService,
  ],
})
export class PurchaseModule {}
