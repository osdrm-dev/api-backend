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
import { UploadModule } from './upload/upload.module';

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
    WinstonModule.forRoot(winstonConfig),
    PrismaModule,
    LoggerModule,
    AuthModule,
    AuditModule,
    PurchaseValidationModule,
    PurchaseModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // NE PAS mettre les guards en global - les appliquer au niveau des contrôleurs
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
