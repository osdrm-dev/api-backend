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
  @ApiOperation({
    summary: 'Creer une nouvelle DA (Step 1)',
    description: `
      Cree une nouvelle demande d'achat avec les informations generales.
      La DA est creee en statut DRAFT.
      
      Etapes suivantes:
      1. Ajouter les articles (POST /purchases/:id/items)
      2. Publier pour validation (POST /purchases/:id/publish)
    `,
  })
  @ApiBody({ type: CreatePurchaseDto })
  @ApiCreatedResponse('DA creee avec succes', {
    id: 'da-123',
    reference: 'DA-2024-0001',
    status: 'DRAFT',
    currentStep: 'DA',
    message: 'DA creee avec succes. Ajoutez maintenant les articles.',
  })
  @ApiBadRequestResponse()
  @ApiCommonResponses()
  async createPurchase(@Request() req, @Body() createDto: CreatePurchaseDto) {
    return this.purchaseService.createPurchase(req.user.id, createDto);
  }

  @Post(':id/items')
  @ApiOperation({
    summary: 'Ajouter des articles a la DA',
    description: "Ajoute ou remplace les articles d'une DA en brouillon",
  })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiBody({ type: AddPurchaseItemsDto })
  @ApiSuccessResponse('Articles ajoutes avec succes', {
    purchaseId: 'da-123',
    items: [],
    message: 'Articles ajoutes avec succes',
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
  @ApiOperation({
    summary: 'Publier la DA pour validation (Step 2)',
    description: `
      Publie la DA et cree le workflow de validation initial.
      
      Le workflow est determine selon le montant:
      - < 5M MGA: DEMANDEUR -> RFR -> CPR
      - >= 5M MGA: DEMANDEUR -> DP -> CFO -> CEO
      
      Le demandeur valide automatiquement.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiSuccessResponse('DA publiee avec succes', {
    id: 'da-123',
    reference: 'DA-2024-0001',
    status: 'PUBLISHED',
    workflow: [],
    message: 'DA publiee avec succes. En attente de validation.',
  })
  @ApiNotFoundResponse('DA')
  @ApiBadRequestResponse('DA deja publiee ou sans articles')
  @ApiCommonResponses()
  async publishPurchase(@Param('id') id: string, @Request() req) {
    return this.purchaseService.publishPurchaseForValidation(id, req.user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Recuperer les details d'une DA",
    description:
      "Recupere tous les details d'une DA incluant items, attachments, workflow",
  })
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

  @Get()
  @ApiOperation({
    summary: 'Lister mes DA',
    description:
      "Recupere la liste des DA creees par l'utilisateur connecte avec filtres et pagination",
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

  @Delete(':id')
  @ApiOperation({
    summary: 'Supprimer une DA en brouillon',
    description: 'Supprime une DA en statut DRAFT uniquement',
  })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiSuccessResponse('DA supprimee', { message: 'DA supprimee avec succes' })
  @ApiNotFoundResponse('DA')
  @ApiBadRequestResponse('Seules les DA en brouillon peuvent etre supprimees')
  @ApiCommonResponses()
  async deletePurchase(@Param('id') id: string, @Request() req) {
    return this.purchaseService.deleteDraftPurchase(id, req.user.id);
  }

  @Post(':id/update-and-republish')
  @ApiOperation({
    summary: 'Modifier et republier une DA avec modifications demandees',
    description:
      'Permet au demandeur de modifier une DA avec status CHANGE_REQUESTED et la republier',
  })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiBody({ type: CreatePurchaseDto })
  @ApiSuccessResponse('DA modifiee', {
    id: 'da-123',
    reference: 'DA-2024-0001',
    status: 'DRAFT',
    message: 'DA modifiee avec succes. Vous pouvez maintenant la republier.',
  })
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
    description:
      "Permet de modifier l'adresse de livraison, la date souhaitee et les observations",
  })
  @ApiParam({ name: 'id', description: 'ID de la DA' })
  @ApiBody({ type: UpdateLogisticsDto })
  @ApiSuccessResponse('DA mise a jour', {
    id: 'da-123',
    reference: 'DA-2024-0001',
    deliveryAddress: 'Region Bureau',
    requestedDeliveryDate: '2026-02-24',
    observations: 'Livraison urgente',
    message: 'Informations logistiques mises a jour avec succes',
  })
  @ApiNotFoundResponse('DA')
  @ApiCommonResponses()
  async updateLogistics(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateLogisticsDto,
  ) {
    return this.purchaseService.updateLogistics(id, req.user.id, dto);
  }
}
