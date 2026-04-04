import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { winstonConfig } from './auth/logger/winston.config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from 'prisma/prisma.module';
import { LoggerModule } from 'src/auth/logger/logger.module';
import { AuthMiddleware } from './auth/middlewares/auth.middleware';
import { AuditMiddleware } from './auth/middlewares/audit.middleware';
import { RateLimitMiddleware } from './auth/middlewares/rate-limit.middleware';
import { HttpLoggingInterceptor } from 'src/auth/logger/http-logging.interceptor';

import { AuditModule } from './audit/audit.module';
import { PurchaseValidationModule } from './purchaseValidation/purchase.module';
import { PurchaseModule } from './purchase/purchase.module';
import { StatisticsModule } from './statistics/statistics.module';
import { FileStorageModule } from 'src/storage/file.module';
import { SupplierModule } from './supplier/supplier.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationModule } from './notification/notification.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { SatisfactionModule } from './satisfaction/satisfaction.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV}.local`,
        `.env.${process.env.NODE_ENV}`,
        '.env',
        '.env.prod',
      ],
    }),
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST || 'localhost',
        port: Number(process.env.MAIL_PORT) || 1025,
        ignoreTLS: process.env.NODE_ENV !== 'production',
        secure: process.env.NODE_ENV === 'production',
      },
      defaults: {
        from: '"No Reply" <noreply@osdrm.mg>',
      },
    }),
    WinstonModule.forRoot(winstonConfig),
    PrismaModule,
    LoggerModule,
    AuthModule,
    AuditModule,
    PurchaseValidationModule,
    PurchaseModule,
    StatisticsModule,
    SupplierModule,
    NotificationModule,
    SatisfactionModule,
    FileStorageModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // {
    //   provide: APP_GUARD,
    //   useClass: JwtAuthGuard,
    // },
    // {
    //   provide: APP_GUARD,
    //   useClass: RolesGuard,
    // },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware, AuditMiddleware, RateLimitMiddleware)
      .forRoutes('*');
  }
}
