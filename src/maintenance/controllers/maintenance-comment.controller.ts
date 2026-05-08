import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { MaintenanceCommentService } from '../services/maintenance-comment.service';
import { AddMaintenanceCommentDto } from '../dto/add-maintenance-comment.dto';

class GetCommentsQueryDto {
  page?: number;
  limit?: number;
}

@ApiTags('Logistique - Entretien / Réparation')
@ApiBearerAuth()
@Controller('logistique/entretien')
@UseGuards(JwtAuthGuard)
export class MaintenanceCommentController {
  constructor(private readonly commentService: MaintenanceCommentService) {}

  @Post(':id/comments')
  @ApiOperation({
    summary: 'Ajouter un commentaire sur une demande de maintenance',
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  addComment(
    @Param('id') requestId: string,
    @Body() dto: AddMaintenanceCommentDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.commentService.addComment(requestId, userId, dto.content);
  }

  @Get(':id/comments')
  @ApiOperation({
    summary: "Récupérer les commentaires d'une demande de maintenance",
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  getComments(
    @Param('id') requestId: string,
    @Query() query: GetCommentsQueryDto,
  ) {
    return this.commentService.getComments(
      requestId,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }
}
