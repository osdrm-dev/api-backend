import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';
import { BudgetModule } from 'src/budget/budget.module';
import { CommentModule } from 'src/comment/comment.module';

import { MissionRepository } from 'src/repository/mission/mission.repository';
import { MissionCommentRepository } from 'src/repository/mission/mission-comment.repository';
import { SettlementValidationRepository } from 'src/repository/mission/settlement-validation.repository';

import { MissionService } from './services/mission.service';
import { MissionStatusService } from './services/mission-status.service';
import { MissionAssignService } from './services/mission-assign.service';
import { MissionConfirmService } from './services/mission-confirm.service';
import { MissionTriggerDaService } from './services/mission-trigger-da.service';
import { MissionSettlementService } from './services/mission-settlement.service';
import { SettlementValidationService } from './services/settlement-validation.service';
import { MissionCommentService } from './services/mission-comment.service';

import { MissionController } from './controllers/mission.controller';
import { MissionCommentController } from './controllers/mission-comment.controller';

@Module({
  imports: [PrismaModule, NotificationModule, BudgetModule, CommentModule],
  controllers: [MissionController, MissionCommentController],
  providers: [
    MissionRepository,
    MissionCommentRepository,
    SettlementValidationRepository,
    MissionService,
    MissionStatusService,
    MissionAssignService,
    MissionConfirmService,
    MissionTriggerDaService,
    MissionSettlementService,
    SettlementValidationService,
    MissionCommentService,
  ],
  exports: [MissionService, MissionRepository],
})
export class MissionModule {}
