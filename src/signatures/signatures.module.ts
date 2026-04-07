import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { FileStorageModule } from 'src/storage/file.module';
import { SignaturesController } from './controllers/signatures.controller';
import { SignaturesService } from './services/signatures.service';
import { SignatureSpecimenRepository } from './repository/signature-specimen.repository';

@Module({
  imports: [PrismaModule, FileStorageModule],
  controllers: [SignaturesController],
  providers: [SignaturesService, SignatureSpecimenRepository],
})
export class SignaturesModule {}
