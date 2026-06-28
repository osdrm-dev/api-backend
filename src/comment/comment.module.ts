import { Module } from '@nestjs/common';
import { CommentController } from './controllers/comment.controller';
import { CommentService } from './services/comment.service';
import { UnifiedCommentService } from './services/unified-comment.service';
import { CommentRepository } from 'src/repository/purchase/comment.repository';
import { UnifiedCommentRepository } from 'src/repository/comment/unified-comment.repository';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [CommentController],
  providers: [
    CommentService,
    CommentRepository,
    UnifiedCommentService,
    UnifiedCommentRepository,
    PrismaService,
  ],
  exports: [UnifiedCommentService],
})
export class CommentModule {}
