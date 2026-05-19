import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { TripCommentService } from '../services/trip-comment.service';
import { AddTripCommentDto } from '../dto/add-trip-comment.dto';

@ApiTags('Logistique - Trajets')
@ApiBearerAuth()
@Controller('logistique/trips/:id/comments')
@UseGuards(JwtAuthGuard)
export class TripCommentController {
  constructor(private readonly commentService: TripCommentService) {}

  @Get()
  @ApiOperation({ summary: "Lister les commentaires d'un trajet" })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async getComments(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.commentService.getComments(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Ajouter un commentaire sur un trajet' })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddTripCommentDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.commentService.addComment(id, dto.content, user);
  }
}
