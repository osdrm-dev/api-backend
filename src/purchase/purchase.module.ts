import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PurchaseValidationModule } from '../purchaseValidation/purchase.module';

import { PurchaseController } from './controllers/purchase.controller';
import { QuotationController } from './controllers/quotation.controller';
import { DerogationController } from './controllers/derogation.controller';
import { PVController } from './controllers/pv.controller';
import { AttachmentController } from './controllers/attachment.controller';

import { PurchaseService } from './services/purchase.service';
import { PVService } from './services/pv.service';
import { QuotationService } from './services/quotation.service';
import { DerogationService } from './services/derogation.service';
import { WorkflowService } from './services/workflow.service';
import { AttachmentService } from './services/attachment.service';
import { SubmitService } from './services/submit.service';
import { PVRepository } from '../repository/purchase/pv.repository';

@Module({
  imports: [PrismaModule, PurchaseValidationModule],
  controllers: [
    PurchaseController,
    QuotationController,
    DerogationController,
    PVController,
    AttachmentController,
  ],
  providers: [
    PurchaseService,
    QuotationService,
    DerogationService,
    WorkflowService,
    PVService,
    PVRepository,
    AttachmentService,
    SubmitService,
  ],
  exports: [
    PurchaseService,
    QuotationService,
    DerogationService,
    WorkflowService,
    PVService,
  ],
})
export class PurchaseModule {}
