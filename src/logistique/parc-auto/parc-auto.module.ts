import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { FileStorageModule } from 'src/storage/file.module';
import { NotificationModule } from 'src/notification/notification.module';
import { ParcAutoRepository } from 'src/repository/parc-auto/parc-auto.repository';
import { ParcAutoService } from './parc-auto.service';
import { ParcAutoController } from './parc-auto.controller';
import { ParcAutoAlertCron } from './parc-auto-alert.cron';

@Module({
  imports: [PrismaModule, FileStorageModule, NotificationModule],
  controllers: [ParcAutoController],
  providers: [ParcAutoRepository, ParcAutoService, ParcAutoAlertCron],
  exports: [ParcAutoService],
})
export class ParcAutoModule {}
