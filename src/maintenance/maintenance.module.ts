import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';
import { BudgetModule } from 'src/budget/budget.module';

import { MaintenanceRepository } from 'src/repository/maintenance/maintenance.repository';
import { MaintenanceCommentRepository } from 'src/repository/maintenance/comment.repository';

import { MaintenanceService } from './services/maintenance.service';
import { MaintenanceStatusService } from './services/maintenance-status.service';
import { TriggerDaService } from './services/trigger-da.service';
import { MaintenanceCommentService } from './services/maintenance-comment.service';

import { MaintenanceController } from './controllers/maintenance.controller';
import { MaintenanceCommentController } from './controllers/maintenance-comment.controller';

@Module({
  imports: [PrismaModule, NotificationModule, BudgetModule],
  controllers: [MaintenanceController, MaintenanceCommentController],
  providers: [
    MaintenanceRepository,
    MaintenanceCommentRepository,
    MaintenanceService,
    MaintenanceStatusService,
    TriggerDaService,
    MaintenanceCommentService,
  ],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
