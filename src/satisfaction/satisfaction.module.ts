import { Module } from '@nestjs/common';
import { SatisfactionController } from './controllers/satisfaction.controller';
import { SatisfactionService } from './services/satisfaction.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [SatisfactionController],
  providers: [SatisfactionService, PrismaService],
  exports: [SatisfactionService],
})
export class SatisfactionModule {}
