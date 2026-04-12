import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationService } from './services/nofitication.service';
import { NotificationRepository } from 'src/repository/notification/notification.repository';
import { NotificationCron } from './notification.cron';
import { NotificationController } from './controllers/notification.controller';
import { PrismaService } from 'prisma/prisma.service';
import { AuditModule } from 'src/audit/audit.module';
import { ResendModule } from 'src/resend/resend.module';
import { NOTIFICATION_MAIL_QUEUE } from './constants/notification.constants';
import { NotificationMailProcessor } from './processors/notification-mail.processor';

@Module({
  imports: [
    ResendModule,
    AuditModule,
    BullModule.registerQueue({ name: NOTIFICATION_MAIL_QUEUE }),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationRepository,
    NotificationCron,
    PrismaService,
    NotificationMailProcessor,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
