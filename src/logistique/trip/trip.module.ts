import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';

import { TripRepository } from 'src/repository/trip/trip.repository';
import { TripCommentRepository } from 'src/repository/trip/trip-comment.repository';

import { TripService } from './services/trip.service';
import { TripStatusService } from './services/trip-status.service';
import { TripCommentService } from './services/trip-comment.service';

import { TripController } from './controllers/trip.controller';
import { TripCommentController } from './controllers/trip-comment.controller';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [TripController, TripCommentController],
  providers: [
    TripRepository,
    TripCommentRepository,
    TripService,
    TripStatusService,
    TripCommentService,
  ],
  exports: [TripService],
})
export class TripModule {}
