import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileStorageController } from './controllers/file-storage.controller';
import { FileStorageService } from './services/file-storage.service';
import { FileOptimizationService } from 'src/storage/services/file-otpimizations.service';
import { PrismaService } from 'prisma/prisma.service';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: configService.get<number>('MAX_FILE_SIZE') || 10485760,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [FileStorageController],
  providers: [FileStorageService, FileOptimizationService, PrismaService],
  exports: [FileStorageService, FileOptimizationService],
})
export class FileStorageModule {}
