import { Module } from '@nestjs/common';
import { StatisticsController } from './controllers/statistics.controller';
import { StatisticsService } from './services/statistics.service';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
