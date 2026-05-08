import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { DeplacementCommentService } from '../services/deplacement-comment.service';
import { AddDeplacementCommentDto } from '../dto/add-deplacement-comment.dto';

@ApiTags('Logistique - Déplacements')
@ApiBearerAuth()
@Controller('logistique/deplacements/:id/comments')
@UseGuards(JwtAuthGuard)
export class DeplacementCommentController {
  constructor(private readonly commentService: DeplacementCommentService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un commentaire sur une demande' })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddDeplacementCommentDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.commentService.addComment(id, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: "Lister les commentaires d'une demande" })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async getComments(@Param('id') id: string) {
    return this.commentService.getComments(id);
  }
}
