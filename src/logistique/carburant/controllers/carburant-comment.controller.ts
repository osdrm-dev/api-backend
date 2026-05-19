import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CarburantCommentService } from '../carburant-comment.service';
import { AddCarburantCommentDto } from '../dto/add-carburant-comment.dto';

@ApiTags('Logistique - Carburant')
@ApiBearerAuth()
@Controller('logistique/carburants/:id/comments')
@UseGuards(JwtAuthGuard)
export class CarburantCommentController {
  constructor(
    private readonly carburantCommentService: CarburantCommentService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Lister les commentaires d'un approvisionnement" })
  @ApiParam({ name: 'id', description: "Identifiant de l'approvisionnement" })
  async getComments(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.carburantCommentService.getComments(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Ajouter un commentaire à un approvisionnement' })
  @ApiParam({ name: 'id', description: "Identifiant de l'approvisionnement" })
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddCarburantCommentDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.carburantCommentService.addComment(id, dto.content, user);
  }
}
