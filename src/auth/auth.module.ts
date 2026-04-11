import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { PrismaModule } from 'prisma/prisma.module';
import { AuthMiddleware } from './middlewares/auth.middleware';
import { AuditMiddleware } from './middlewares/audit.middleware';
import { RateLimitMiddleware } from './middlewares/rate-limit.middleware';
import { AuditModule } from 'src/audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: 900,
        },
      }),
      inject: [ConfigService],
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    AuthMiddleware,
    AuditMiddleware,
    RateLimitMiddleware,
  ],
  exports: [
    AuthService,
    TokenService,
    JwtModule,
    AuditModule,
    AuthMiddleware,
    AuditMiddleware,
    RateLimitMiddleware,
  ],
})
export class AuthModule {}
