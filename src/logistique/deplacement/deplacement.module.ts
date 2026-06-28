import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';
import { BudgetModule } from 'src/budget/budget.module';
import { CommentModule } from 'src/comment/comment.module';

import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { DeplacementCommentRepository } from 'src/repository/deplacement/deplacement-comment.repository';
import { LiquidationValidationRepository } from 'src/repository/deplacement/liquidation-validation.repository';

import { DeplacementService } from './services/deplacement.service';
import { DeplacementStatusService } from './services/deplacement-status.service';
import { DeplacementAssignService } from './services/deplacement-assign.service';
import { DeplacementConfirmService } from './services/deplacement-confirm.service';
import { DeplacementTriggerDaService } from './services/deplacement-trigger-da.service';
import { DeplacementLiquidationService } from './services/deplacement-liquidation.service';
import { LiquidationValidationService } from './services/deplacement-liquidation-validation.service';
import { DeplacementCommentService } from './services/deplacement-comment.service';

import { DeplacementController } from './controllers/deplacement.controller';
import { DeplacementCommentController } from './controllers/deplacement-comment.controller';

@Module({
  imports: [PrismaModule, NotificationModule, BudgetModule, CommentModule],
  controllers: [DeplacementController, DeplacementCommentController],
  providers: [
    DeplacementRepository,
    DeplacementCommentRepository,
    LiquidationValidationRepository,
    DeplacementService,
    DeplacementStatusService,
    DeplacementAssignService,
    DeplacementConfirmService,
    DeplacementTriggerDaService,
    DeplacementLiquidationService,
    LiquidationValidationService,
    DeplacementCommentService,
  ],
  exports: [DeplacementService],
})
export class DeplacementModule {}
