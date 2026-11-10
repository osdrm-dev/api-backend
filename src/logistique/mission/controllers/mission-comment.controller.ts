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
import { AddMissionCommentDto } from '../dto/add-mission-comment.dto';

@ApiTags('Logistique - Trajets')
@ApiBearerAuth()
@Controller('logistique/missions/:id/comments')
@UseGuards(JwtAuthGuard)
export class MissionCommentController {
  constructor(private readonly commentService: UnifiedCommentService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un comment sur une demande' })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddMissionCommentDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.commentService.create(CommentEntityType.MISSION, id, userId, {
      content: dto.content,
    });
  }

  @Get()
  @ApiOperation({ summary: "Lister les commentaires d'une demande" })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async getComments(@Param('id') id: string) {
    return this.commentService.findPaginated(
      CommentEntityType.MISSION,
      id,
      1,
      20,
    );
  }
}
