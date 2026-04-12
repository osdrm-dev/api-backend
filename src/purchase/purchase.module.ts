import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PurchaseValidationModule } from '../purchaseValidation/purchase.module';
import { BudgetModule } from '../budget/budget.module';
import { PdfSigningModule } from '../pdf-signing/pdf-signing.module';

import { PurchaseController } from './controllers/purchase.controller';
import { QuotationController } from './controllers/quotation.controller';
import { DerogationController } from './controllers/derogation.controller';
import { PVController } from './controllers/pv.controller';
import { AttachmentController } from './controllers/attachment.controller';
import { BCController } from './controllers/bc.controller';
import {
  BRController,
  InvoiceController,
  DAPController,
  ProofOfPaymentController,
} from './controllers/step.controller';
import { SignController } from './controllers/sign.controller';

import { PurchaseService } from './services/purchase.service';
import { PVService } from './services/pv.service';
import { QuotationService } from './services/quotation.service';
import { DerogationService } from './services/derogation.service';
import { WorkflowService } from './services/workflow.service';
import { AttachmentService } from './services/attachment.service';
import { SubmitService } from './services/submit.service';
import { BCService } from './services/bc.service';
import { DocumentStepService } from 'src/purchase/services/step.service';
import { PVRepository } from '../repository/purchase/pv.repository';

@Module({
  imports: [
    PrismaModule,
    PurchaseValidationModule,
    BudgetModule,
    PdfSigningModule,
  ],
  controllers: [
    PurchaseController,
    QuotationController,
    DerogationController,
    PVController,
    AttachmentController,
    BCController,
    BRController,
    InvoiceController,
    DAPController,
    ProofOfPaymentController,
    SignController,
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
    BCService,
    DocumentStepService,
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
