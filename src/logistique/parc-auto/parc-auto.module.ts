import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { FileStorageModule } from 'src/storage/file.module';
import { NotificationModule } from 'src/notification/notification.module';
import { ParcAutoRepository } from 'src/repository/parc-auto/parc-auto.repository';
import { UserModule as UserRepositoryModule } from 'src/repository/user';
import { ParcAutoService } from './parc-auto.service';
import { MyVehiclesService } from './services/my-vehicles.service';
import { ParcAutoController } from './parc-auto.controller';
import { ParcAutoAlertCron } from './parc-auto-alert.cron';

@Module({
  imports: [
    PrismaModule,
    FileStorageModule,
    NotificationModule,
    UserRepositoryModule,
  ],
  controllers: [ParcAutoController],
  providers: [
    ParcAutoRepository,
    ParcAutoService,
    MyVehiclesService,
    ParcAutoAlertCron,
  ],
  exports: [ParcAutoService],
})
export class ParcAutoModule {}
