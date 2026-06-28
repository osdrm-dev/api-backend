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
import { AddDeplacementCommentDto } from '../dto/add-deplacement-comment.dto';

@ApiTags('Logistique - Déplacements')
@ApiBearerAuth()
@Controller('logistique/deplacements/:id/comments')
@UseGuards(JwtAuthGuard)
export class DeplacementCommentController {
  constructor(private readonly commentService: UnifiedCommentService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un commentaire sur une demande' })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddDeplacementCommentDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.commentService.create(
      CommentEntityType.DEPLACEMENT,
      id,
      userId,
      { content: dto.content },
    );
  }

  @Get()
  @ApiOperation({ summary: "Lister les commentaires d'une demande" })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async getComments(@Param('id') id: string) {
    return this.commentService.findPaginated(
      CommentEntityType.DEPLACEMENT,
      id,
      1,
      20,
    );
  }
}
