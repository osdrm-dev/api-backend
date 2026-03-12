import { Module } from '@nestjs/common';
import { NotificationService } from './services/nofitication.service';
import { NotificationRepository } from 'src/repository/notification/notification.repository';
import { NotificationCron } from './notification.cron';
import { PrismaService } from 'prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [MailerModule],
  providers: [
    NotificationService,
    NotificationRepository,
    NotificationCron,
    MailService,
    PrismaService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
