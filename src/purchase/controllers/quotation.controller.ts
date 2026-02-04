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
import { QuotationService } from '../services/quotation.service';
import { UploadQuoteDto } from '../dto/quotation.dto';
import { CreateDerogationDto } from '../dto/derogation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  ApiSuccessResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiCommonResponses,
} from '../../common/decorators/swagger.decorators';

@ApiTags('QR Management')
@ApiBearerAuth('JWT-auth')
@Controller('purchases/:purchaseId/quotations')
@UseGuards(JwtAuthGuard)
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Get('level-info')
  @ApiOperation({
    summary: 'Obtenir les informations sur le niveau de devis requis',
    description: `
      Retourne le niveau de devis requis selon le montant de la DA:
      - Niveau 1: < 500,000 MGA = 1 devis
      - Niveau 2: 500,000 - 2,000,000 MGA = 2-3 devis
      - Niveau 3: 2,000,000 - 5,000,000 MGA = 3 devis
      - Niveau 4: >= 5,000,000 MGA = 3+ devis
    `,
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiSuccessResponse('Informations sur le niveau', {
    purchaseId: 'da-123',
    reference: 'DA-2024-0001',
    amount: 10000000,
    level: 4,
    levelLabel: 'Niveau 4',
    description: '>= 5,000,000 MGA - 3 devis minimum requis',
    requiredQuotes: 3,
    uploadedQuotes: 2,
    canProceed: false,
    needsDerogation: true,
  })
  @ApiNotFoundResponse('DA')
  @ApiCommonResponses()
  async getQuoteLevelInfo(
    @Param('purchaseId') purchaseId: string,
    @Request() req,
  ) {
    return this.quotationService.getQuoteLevelInfo(purchaseId, req.user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Uploader un devis',
    description: 'Ajoute un devis a la DA (Step 3)',
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiBody({ type: UploadQuoteDto })
  @ApiCreatedResponse('Devis uploade avec succes', {
    id: 'att-123',
    fileName: 'devis-fournisseur-A.pdf',
    message: 'Devis telecharge avec succes',
  })
  @ApiNotFoundResponse('DA')
  @ApiBadRequestResponse("DA pas a l'etape QR")
  @ApiCommonResponses()
  async uploadQuote(
    @Param('purchaseId') purchaseId: string,
    @Request() req,
    @Body() quoteDto: UploadQuoteDto,
  ) {
    return this.quotationService.uploadQuote(purchaseId, req.user.id, quoteDto);
  }

  @Get()
  @ApiOperation({
    summary: "Lister les devis d'une DA",
    description: 'Recupere tous les devis uploades pour une DA',
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiSuccessResponse('Liste des devis', {
    purchaseId: 'da-123',
    quotes: [],
    total: 3,
  })
  @ApiNotFoundResponse('DA')
  @ApiCommonResponses()
  async listQuotes(@Param('purchaseId') purchaseId: string, @Request() req) {
    return this.quotationService.listQuotes(purchaseId, req.user.id);
  }

  @Delete(':quoteId')
  @ApiOperation({
    summary: 'Supprimer un devis',
    description: 'Supprime un devis uploade',
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiParam({ name: 'quoteId', description: 'ID du devis' })
  @ApiSuccessResponse('Devis supprime', {
    message: 'Devis supprime avec succes',
  })
  @ApiNotFoundResponse('Devis')
  @ApiCommonResponses()
  async deleteQuote(
    @Param('purchaseId') purchaseId: string,
    @Param('quoteId') quoteId: string,
    @Request() req,
  ) {
    return this.quotationService.deleteQuote(purchaseId, quoteId, req.user.id);
  }

  @Post('derogation')
  @ApiOperation({
    summary: 'Demander une derogation pour devis insuffisants',
    description: `
      Demande une derogation si le nombre de devis est insuffisant.
      La DA passe en statut IN_DEROGATION.
    `,
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiBody({ type: CreateDerogationDto })
  @ApiCreatedResponse('Derogation demandee', {
    id: 'derog-123',
    purchaseId: 'da-123',
    status: 'PENDING',
    message: 'Demande de derogation soumise avec succes',
  })
  @ApiNotFoundResponse('DA')
  @ApiBadRequestResponse('Devis deja suffisants ou derogation existante')
  @ApiCommonResponses()
  async requestDerogation(
    @Param('purchaseId') purchaseId: string,
    @Request() req,
    @Body() derogationDto: CreateDerogationDto,
  ) {
    return this.quotationService.requestQuoteDerogation(
      purchaseId,
      req.user.id,
      derogationDto,
    );
  }

  @Post('validate')
  @ApiOperation({
    summary: "Valider les devis et passer a l'etape suivante",
    description: `
      Valide que les devis sont complets et fait passer la DA a l'etape suivante.
      Verifie qu'il y a assez de devis ou qu'une derogation est validee.
    `,
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiSuccessResponse('Devis valides', {
    id: 'da-123',
    currentStep: 'PV',
    message: "Devis valides. Passage a l'etape suivante.",
  })
  @ApiNotFoundResponse('DA')
  @ApiBadRequestResponse('Devis insuffisants')
  @ApiCommonResponses()
  async validateQuotes(
    @Param('purchaseId') purchaseId: string,
    @Request() req,
  ) {
    return this.quotationService.validateQuotesAndProceed(
      purchaseId,
      req.user.id,
    );
  }
}
