import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AttachmentService } from '../services/attachment.service';
import { CreateAttachmentDto } from '../dto/attachment.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  ApiSuccessResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiCommonResponses,
} from '../../common/decorators/swagger.decorators';

@ApiTags('Attachments')
@ApiBearerAuth('JWT-auth')
@Controller('purchases/:purchaseId/attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post()
  @ApiOperation({
    summary: 'Ajouter un document a la DA',
    description: `
      Lie un fichier uploade via /files/upload a une DA.
      
      Types de documents:
      - QUOTATION: Devis fournisseur
      - PURCHASE_ORDER: Bon de commande (ACHETEUR uniquement)
      - DELIVERY_NOTE: Bon de livraison
      - INVOICE: Facture
      - OTHER: Autre document
    `,
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiBody({ type: CreateAttachmentDto })
  @ApiCreatedResponse('Document ajoute', {
    id: 'att-123',
    fileName: 'bc-fournisseur-a.pdf',
    fileUrl: '/files/abc123.pdf',
    type: 'PURCHASE_ORDER',
    message: 'Document ajoute avec succes',
  })
  @ApiNotFoundResponse('DA ou fichier non trouve')
  @ApiBadRequestResponse()
  @ApiCommonResponses()
  async createAttachment(
    @Param('purchaseId') purchaseId: string,
    @Request() req,
    @Body() dto: CreateAttachmentDto,
  ) {
    return this.attachmentService.createAttachment(
      req.user.id,
      purchaseId,
      dto,
    );
  }

  @Get()
  @ApiOperation({
    summary: "Lister les documents d'une DA",
    description: 'Recupere tous les documents attaches a une DA',
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiSuccessResponse('Liste des documents', {
    purchaseId: 'da-123',
    attachments: [],
    total: 3,
  })
  @ApiNotFoundResponse('DA')
  @ApiCommonResponses()
  async listAttachments(@Param('purchaseId') purchaseId: string) {
    return this.attachmentService.listAttachments(purchaseId);
  }

  @Delete(':attachmentId')
  @ApiOperation({
    summary: 'Supprimer un document',
    description: 'Supprime un document attache a une DA',
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiParam({ name: 'attachmentId', description: 'ID du document' })
  @ApiSuccessResponse('Document supprime', {
    message: 'Document supprime avec succes',
  })
  @ApiNotFoundResponse('Document')
  @ApiCommonResponses()
  async deleteAttachment(
    @Param('purchaseId') purchaseId: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req,
  ) {
    return this.attachmentService.deleteAttachment(
      req.user.id,
      purchaseId,
      attachmentId,
    );
  }
}
