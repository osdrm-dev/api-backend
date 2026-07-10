import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailProcessor } from './processors/mail.processor';
import { MAIL_QUEUE } from './constants/mail.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: MAIL_QUEUE }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('MAIL_HOST'),
          port: Number(config.get<string>('MAIL_PORT')),
          secure: config.get<string>('MAIL_SECURE') === 'true',
          auth: {
            user: config.get<string>('MAIL_USER'),
            pass: config.get<string>('MAIL_PASS'),
          },
        },
        defaults: {
          from: config.get<string>('MAIL_FROM'),
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
    }),
  ],

  controllers: [MailController],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
