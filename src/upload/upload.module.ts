import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FileStorageController } from './controllers/file-storage.controller';
import { UploadService } from './services/upload.service';
import { FileStorageService } from './services/file-storage.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads',
    }),
    PrismaModule,
  ],
  controllers: [FileStorageController],
  providers: [UploadService, FileStorageService],
  exports: [UploadService, FileStorageService],
})
export class UploadModule {}
