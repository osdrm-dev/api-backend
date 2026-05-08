import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { FileStorageModule } from 'src/storage/file.module';
import { NotificationModule } from 'src/notification/notification.module';
import { BauxRepository } from 'src/repository/baux/baux.repository';
import { BauxService } from './services/baux.service';
import { BauxAvenantService } from './services/baux-avenant.service';
import { BauxPaiementService } from './services/baux-paiement.service';
import { BauxDashboardService } from './services/baux-dashboard.service';
import { BauxIndexationService } from './services/baux-indexation.service';
import { BauxController } from './baux.controller';
import { BailExpiryAlertCron } from './crons/bail-expiry-alert.cron';
import { BailIndexationCron } from './crons/bail-indexation.cron';

@Module({
  imports: [PrismaModule, FileStorageModule, NotificationModule],
  controllers: [BauxController],
  providers: [
    BauxRepository,
    BauxService,
    BauxAvenantService,
    BauxPaiementService,
    BauxDashboardService,
    BauxIndexationService,
    BailExpiryAlertCron,
    BailIndexationCron,
  ],
  exports: [BauxService],
})
export class BauxModule {}
