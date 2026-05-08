import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { DeplacementService } from '../services/deplacement.service';
import { DeplacementStatusService } from '../services/deplacement-status.service';
import { DeplacementAssignService } from '../services/deplacement-assign.service';
import { DeplacementConfirmService } from '../services/deplacement-confirm.service';
import { DeplacementTriggerDaService } from '../services/deplacement-trigger-da.service';
import { DeplacementLiquidationService } from '../services/deplacement-liquidation.service';
import { CreateDeplacementDto } from '../dto/create-deplacement.dto';
import { FilterDeplacementDto } from '../dto/filter-deplacement.dto';
import { UpdateDeplacementStatusDto } from '../dto/update-deplacement-status.dto';
import { AssignVehicleDto } from '../dto/assign-vehicle.dto';
import { ConfirmDeplacementDto } from '../dto/confirm-deplacement.dto';
import { TriggerDaDeplacementDto } from '../dto/trigger-da-deplacement.dto';
import { CreateLiquidationDto } from '../dto/create-liquidation.dto';

@ApiTags('Logistique - Déplacements')
@ApiBearerAuth()
@Controller('logistique/deplacements')
@UseGuards(JwtAuthGuard)
export class DeplacementController {
  constructor(
    private readonly deplacementService: DeplacementService,
    private readonly statusService: DeplacementStatusService,
    private readonly assignService: DeplacementAssignService,
    private readonly confirmService: DeplacementConfirmService,
    private readonly triggerDaService: DeplacementTriggerDaService,
    private readonly liquidationService: DeplacementLiquidationService,
  ) {}

  @Post()
  @Roles('DEMANDEUR', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Soumettre une demande de déplacement' })
  async create(
    @Body() dto: CreateDeplacementDto,
    @CurrentUser() user: { id: number; role: string },
    @Query('bypassDeadline') bypassDeadline?: string,
  ) {
    const bypass = user.role === 'ADMIN' && bypassDeadline === 'true';
    return this.deplacementService.create(dto, user.id, bypass);
  }

  // GET stats must be before GET /:id
  @Get('stats')
  @Roles('GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'KPIs des déplacements par statut' })
  async getStats() {
    return this.deplacementService.getStats();
  }

  // GET mes-demandes must be before GET /:id
  @Get('mes-demandes')
  @Roles('DEMANDEUR', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Lister mes demandes de déplacement' })
  async getMyRequests(
    @CurrentUser() user: { id: number },
    @Query() query: FilterDeplacementDto,
  ) {
    return this.deplacementService.findMyRequests(user.id, query);
  }

  @Get()
  @Roles('GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Lister toutes les demandes de déplacement' })
  async getAll(@Query() query: FilterDeplacementDto) {
    return this.deplacementService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer une demande de déplacement par son identifiant',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.deplacementService.findById(id, user);
  }

  @Patch(':id/status')
  @Roles('GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Changer le statut d'une demande" })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDeplacementStatusDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.statusService.updateStatus(id, dto, user.id);
  }

  @Patch(':id/assign-vehicle')
  @Roles('GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Affecter un véhicule à une demande' })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async assignVehicle(
    @Param('id') id: string,
    @Body() dto: AssignVehicleDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.assignService.assignVehicle(id, dto, user.id);
  }

  @Patch(':id/confirm')
  @Roles('GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Confirmer une demande avec le montant du per diem',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmDeplacementDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.confirmService.confirm(id, dto, user.id);
  }

  @Post(':id/trigger-da')
  @Roles('GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Déclencher une DA de location de véhicule' })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async triggerDA(
    @Param('id') id: string,
    @Body() dto: TriggerDaDeplacementDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.triggerDaService.triggerDA(id, dto, user.id);
  }

  @Post(':id/liquidation')
  @Roles('DEMANDEUR', 'GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Soumettre le formulaire de liquidation' })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async submitLiquidation(
    @Param('id') id: string,
    @Body() dto: CreateLiquidationDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.liquidationService.submit(id, dto, user.id);
  }

  @Get(':id/liquidation')
  @ApiOperation({ summary: "Récupérer la liquidation d'un déplacement" })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async getLiquidation(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    // ownership check via findById
    await this.deplacementService.findById(id, user);
    return this.liquidationService.getLiquidation(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Annuler une demande de déplacement' })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.deplacementService.cancel(id, user);
  }
}
