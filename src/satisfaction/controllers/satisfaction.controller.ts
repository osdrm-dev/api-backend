import {
  Controller,
  Post,
  Get,
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
  ApiQuery,
} from '@nestjs/swagger';
import { SatisfactionService } from '../services/satisfaction.service';
import { CreateSatisfactionDto } from '../dto/create-satisfaction.dto';
import { FilterSatisfactionDto } from '../dto/filter-satisfaction.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Satisfaction')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('satisfaction')
export class SatisfactionController {
  constructor(private readonly satisfactionService: SatisfactionService) {}

  @Post(':purchaseId')
  @ApiOperation({
    summary: 'Soumettre une enquête de satisfaction pour un achat',
  })
  @ApiResponse({ status: 201, description: 'Enquête créée avec succès' })
  @ApiResponse({
    status: 400,
    description: 'Enquête déjà existante ou achat non terminé',
  })
  @ApiResponse({ status: 404, description: 'Achat non trouvé' })
  create(
    @Param('purchaseId') purchaseId: string,
    @Body() dto: CreateSatisfactionDto,
  ) {
    return this.satisfactionService.create(purchaseId, dto);
  }

  @Get('purchase/:purchaseId')
  @ApiOperation({ summary: "Récupérer l'enquête de satisfaction d'un achat" })
  @ApiResponse({ status: 200, description: 'Enquête récupérée' })
  findByPurchase(@Param('purchaseId') purchaseId: string) {
    return this.satisfactionService.findByPurchase(purchaseId);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les enquêtes de satisfaction' })
  @ApiResponse({ status: 200, description: 'Liste des enquêtes' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Date de début (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Date de fin (ISO 8601)',
  })
  @ApiQuery({
    name: 'supplierId',
    required: false,
    description: 'ID du fournisseur retenu',
  })
  @ApiQuery({
    name: 'marketType',
    required: false,
    description: 'Type de marché',
  })
  @ApiQuery({
    name: 'operationType',
    required: false,
    enum: ['PROGRAMME', 'OPERATION'],
  })
  @ApiQuery({
    name: 'purchaseId',
    required: false,
    description: "ID du dossier d'achat",
  })
  findAll(@Query() filters: FilterSatisfactionDto) {
    return this.satisfactionService.findAll(filters);
  }

  @Get('statistics/summary')
  @ApiOperation({
    summary: 'Obtenir les statistiques des enquêtes de satisfaction',
  })
  @ApiResponse({ status: 200, description: 'Statistiques calculées' })
  getStatistics() {
    return this.satisfactionService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: "Récupérer le détail d'une enquête par son ID" })
  @ApiResponse({ status: 200, description: 'Enquête récupérée' })
  @ApiResponse({ status: 404, description: 'Enquête introuvable' })
  findById(@Param('id') id: string) {
    return this.satisfactionService.findById(id);
  }
}
