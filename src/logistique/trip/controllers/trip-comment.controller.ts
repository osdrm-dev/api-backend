import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CommentEntityType } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UnifiedCommentService } from 'src/comment/services/unified-comment.service';
import { AddTripCommentDto } from '../dto/add-trip-comment.dto';

@ApiTags('Logistique - Trajets')
@ApiBearerAuth()
@Controller('logistique/trips/:id/comments')
@UseGuards(JwtAuthGuard)
export class TripCommentController {
  constructor(private readonly commentService: UnifiedCommentService) {}

  @Get()
  @ApiOperation({ summary: "Lister les commentaires d'un trajet" })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async getComments(@Param('id') id: string) {
    return this.commentService.findPaginated(CommentEntityType.TRIP, id, 1, 20);
  }

  @Post()
  @ApiOperation({ summary: 'Ajouter un commentaire sur un trajet' })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddTripCommentDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.commentService.create(CommentEntityType.TRIP, id, userId, {
      content: dto.content,
    });
  }
}
