import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from 'prisma/prisma.module';
import { FileStorageModule } from 'src/storage/file.module';
import { PurchaseValidationModule } from 'src/purchaseValidation/purchase.module';
import { NotificationModule } from 'src/notification/notification.module';
import { PdfLibService } from './pdf-lib.service';
import { PdfSigningService, PDF_SIGNING_QUEUE } from './pdf-signing.service';
import { PdfSigningProcessor } from './pdf-signing.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: PDF_SIGNING_QUEUE }),
    PrismaModule,
    FileStorageModule,
    PurchaseValidationModule,
    NotificationModule,
  ],
  providers: [PdfLibService, PdfSigningService, PdfSigningProcessor],
  exports: [PdfSigningService],
})
export class PdfSigningModule {}
