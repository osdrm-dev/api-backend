import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WinstonModule } from 'nest-winston';
import { ConfigModule } from '@nestjs/config';
import { winstonConfig } from './logger/winston.config';
import { TaskModule } from './tasks/task.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    TaskModule,

    MailModule,

    ConfigModule.forRoot({
      isGlobal: true,

      envFilePath: [
        '.env.${process.env.NODE_ENV}.local',
        '.env.${process.env.NODE_ENV}',
        '.env',
      ],
    }),

    WinstonModule.forRoot(winstonConfig),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
