import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { CommentEntityType } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UnifiedCommentService } from '../services/unified-comment.service';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { GetCommentsQueryDto } from '../dto/get-comments-query.dto';

@ApiTags('Commentaires')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchases/:id/comments')
export class CommentController {
  constructor(private readonly commentService: UnifiedCommentService) {}

  @Get()
  @ApiOperation({ summary: "Récupérer les commentaires d'un achat" })
  @ApiResponse({ status: 200, description: 'Liste paginée des commentaires' })
  @ApiResponse({ status: 404, description: 'Achat non trouvé' })
  findByPurchase(
    @Param('id') purchaseId: string,
    @Query() query: GetCommentsQueryDto,
  ) {
    return this.commentService.findPaginated(
      CommentEntityType.PURCHASE,
      purchaseId,
      query.page ?? 1,
      query.limit ?? 10,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Ajouter un commentaire sur un achat' })
  @ApiResponse({ status: 201, description: 'Commentaire créé avec succès' })
  @ApiResponse({ status: 404, description: 'Achat non trouvé' })
  @ApiResponse({
    status: 400,
    description: 'Contenu invalide (vide ou > 2000 caractères)',
  })
  create(
    @Param('id') purchaseId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('id') authorId: number,
  ) {
    return this.commentService.create(
      CommentEntityType.PURCHASE,
      purchaseId,
      authorId,
      dto,
    );
  }
}
