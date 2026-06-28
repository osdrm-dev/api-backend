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
import { AddCarburantCommentDto } from '../dto/add-carburant-comment.dto';

@ApiTags('Logistique - Carburant')
@ApiBearerAuth()
@Controller('logistique/carburants/:id/comments')
@UseGuards(JwtAuthGuard)
export class CarburantCommentController {
  constructor(private readonly commentService: UnifiedCommentService) {}

  @Get()
  @ApiOperation({ summary: "Lister les commentaires d'un approvisionnement" })
  @ApiParam({ name: 'id', description: "Identifiant de l'approvisionnement" })
  async getComments(@Param('id') id: string) {
    return this.commentService.findPaginated(
      CommentEntityType.CARBURANT,
      id,
      1,
      20,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Ajouter un commentaire à un approvisionnement' })
  @ApiParam({ name: 'id', description: "Identifiant de l'approvisionnement" })
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddCarburantCommentDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.commentService.create(CommentEntityType.CARBURANT, id, userId, {
      content: dto.content,
    });
  }
}
