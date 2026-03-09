import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { PurchaseService } from '../services/purchase.service';
import { CreatePurchaseDto } from '../dto/create-purchase.dto';
import { AddPurchaseItemsDto } from '../dto/purchase-item.dto';
import { FilterPurchaseDto } from '../dto/filter-purchase.dto';
import { UpdateLogisticsDto } from '../dto/update-logistics.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  ApiSuccessResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiCommonResponses,
  ApiPaginatedResponse,
} from '../../common/decorators/swagger.decorators';

@ApiTags('DA Creation')
@ApiBearerAuth('JWT-auth')
@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post()
  @ApiOperation({ summary: 'Creer une nouvelle DA (Step 1)' })
  @ApiBody({ type: CreatePurchaseDto })
  @ApiCreatedResponse('DA creee avec succes', {
    id: 'da-123',
    reference: 'DA-2024-0001',
    status: 'DRAFT',
    currentStep: 'DA',
  })
  @ApiBadRequestResponse()
  @ApiCommonResponses()
  async createPurchase(@Request() req, @Body() createDto: CreatePurchaseDto) {
    return this.purchaseService.createPurchase(req.user.id, createDto);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Ajouter des articles a la DA' })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiBody({ type: AddPurchaseItemsDto })
  @ApiSuccessResponse('Articles ajoutes avec succes', {
    purchaseId: 'da-123',
    items: [],
  })
  @ApiNotFoundResponse('DA')
  @ApiBadRequestResponse('DA deja publiee')
  @ApiCommonResponses()
  async addItems(
    @Param('id') id: string,
    @Request() req,
    @Body() itemsDto: AddPurchaseItemsDto,
  ) {
    return this.purchaseService.addPurchaseItems(id, req.user.id, itemsDto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publier la DA pour validation (Step 2)' })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiSuccessResponse('DA publiee avec succes', {
    id: 'da-123',
    status: 'PUBLISHED',
    workflow: [],
  })
  @ApiNotFoundResponse('DA')
  @ApiBadRequestResponse('DA deja publiee ou sans articles')
  @ApiCommonResponses()
  async publishPurchase(@Param('id') id: string, @Request() req) {
    return this.purchaseService.publishPurchaseForValidation(id, req.user.id);
  }

  @Post(':id/update-and-republish')
  @ApiOperation({
    summary: 'Modifier et republier une DA avec modifications demandees',
  })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiBody({ type: CreatePurchaseDto })
  @ApiSuccessResponse('DA modifiee', { id: 'da-123', status: 'DRAFT' })
  @ApiNotFoundResponse('DA')
  @ApiBadRequestResponse(
    'Seules les DA avec modifications demandees peuvent etre republiees',
  )
  @ApiCommonResponses()
  async updateAndRepublish(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDto: CreatePurchaseDto,
  ) {
    return this.purchaseService.updateAndRepublishPurchase(
      id,
      req.user.id,
      updateDto,
    );
  }

  @Put(':id')
  @ApiOperation({
    summary: "Mettre a jour les informations logistiques d'une DA",
  })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiBody({ type: UpdateLogisticsDto })
  @ApiSuccessResponse('DA mise a jour', { id: 'da-123' })
  @ApiNotFoundResponse('DA')
  @ApiCommonResponses()
  async updateLogistics(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateLogisticsDto,
  ) {
    return this.purchaseService.updateLogistics(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une DA en brouillon' })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiSuccessResponse('DA supprimee', { message: 'DA supprimee avec succes' })
  @ApiNotFoundResponse('DA')
  @ApiBadRequestResponse('Seules les DA en brouillon peuvent etre supprimees')
  @ApiCommonResponses()
  async deletePurchase(@Param('id') id: string, @Request() req) {
    return this.purchaseService.deleteDraftPurchase(id, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les DA creees par moi',
    description:
      "Retourne uniquement les DA dont l'utilisateur est le createur. Pour les validateurs, utiliser GET /validation/pending. Pour l'acheteur, utiliser GET /purchases/buyer-workspace.",
  })
  @ApiPaginatedResponse({
    id: 'da-123',
    reference: 'DA-2024-0001',
    title: 'Achat materiel',
  })
  @ApiCommonResponses()
  async getMyPurchases(@Request() req, @Query() filters: FilterPurchaseDto) {
    return this.purchaseService.getMyPurchases(req.user.id, filters);
  }
  @Get('buyer-workspace')
  @ApiOperation({
    summary: "Espace de travail de l'acheteur",
    description:
      "DA en attente de traitement par l'acheteur (etapes QR, PV, BC, BR). Utiliser ce endpoint plutot que GET /purchases pour les acheteurs.",
  })
  @ApiPaginatedResponse({
    id: 'da-123',
    reference: 'DA-2024-0001',
    currentStep: 'QR',
  })
  @ApiCommonResponses()
  async getBuyerWorkspace(@Request() req, @Query() filters: FilterPurchaseDto) {
    return this.purchaseService.getBuyerWorkspace(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: "Recuperer les details d'une DA" })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiSuccessResponse('Details de la DA', {
    id: 'da-123',
    reference: 'DA-2024-0001',
    title: 'Achat materiel',
    status: 'PUBLISHED',
    items: [],
    validationWorkflow: {},
  })
  @ApiNotFoundResponse('DA')
  @ApiCommonResponses()
  async getPurchase(@Param('id') id: string, @Request() req) {
    return this.purchaseService.getPurchaseById(id, req.user.id);
  }

  @Get(':id/validation-status')
  @ApiOperation({
    summary: "Statut de validation d'une DA",
    description:
      'Retourne le currentStep et tous les workflows de validation. Accessible par le createur de la DA.',
  })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiSuccessResponse('Statut de validation', {
    id: 'da-123',
    reference: 'DA-2024-0001',
    currentStep: 'QR',
    status: 'PENDING_APPROVAL',
    validationWorkflows: [],
  })
  @ApiNotFoundResponse('DA')
  @ApiCommonResponses()
  async getValidationStatus(@Param('id') id: string, @Request() req) {
    return this.purchaseService.getValidationStatus(id, req.user.id);
  }
}
