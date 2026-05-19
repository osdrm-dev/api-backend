import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';

import { CarburantRepository } from 'src/repository/carburant/carburant.repository';
import { CarburantCommentRepository } from 'src/repository/carburant/carburant-comment.repository';

import { CarburantService } from './carburant.service';
import { CarburantStatusService } from './carburant-status.service';
import { CarburantCommentService } from './carburant-comment.service';

import { CarburantController } from './controllers/carburant.controller';
import { CarburantCommentController } from './controllers/carburant-comment.controller';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [CarburantController, CarburantCommentController],
  providers: [
    CarburantRepository,
    CarburantCommentRepository,
    CarburantService,
    CarburantStatusService,
    CarburantCommentService,
  ],
  exports: [CarburantService],
})
export class CarburantModule {}
