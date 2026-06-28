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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LgLiquidationValidatorRole } from '@prisma/client';
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
import { DecideLiquidationValidationDto } from '../dto/decide-liquidation-validation.dto';
import { ResubmitLiquidationDto } from '../dto/resubmit-liquidation.dto';
import { LiquidationValidationService } from '../services/deplacement-liquidation-validation.service';

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
    private readonly liquidationValidationService: LiquidationValidationService,
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
  @ApiOperation({
    summary: "Récupérer la liquidation d'un déplacement (avec ses validations)",
  })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  async getLiquidation(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    // ownership check via findById
    await this.deplacementService.findById(id, user);
    return this.liquidationService.getLiquidation(id);
  }

  @Get(':id/liquidation/validations')
  @ApiOperation({
    summary: 'Détail des 3 validations (DEMANDEUR, OM, CFO) de la liquidation',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  @ApiResponse({
    status: 200,
    description: 'Liste des 3 lignes de validation.',
  })
  @ApiResponse({ status: 404, description: 'Aucune liquidation soumise.' })
  async getLiquidationValidations(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    // ownership check via findById
    await this.deplacementService.findById(id, user);
    return this.liquidationValidationService.getValidationDetail(id);
  }

  @Post(':id/liquidation/validations/decision')
  @Roles('DEMANDEUR', 'OM', 'CFO', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary:
      'Valider ou rejeter la ligne de validation correspondant à son rôle',
    description:
      "Le rôle ciblé est déduit du rôle de l'utilisateur courant (DEMANDEUR → sa propre ligne, OM, CFO). " +
      'Un ADMIN doit préciser le rôle ciblé via le query param `role`.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: LgLiquidationValidatorRole,
    description: 'Rôle ciblé (obligatoire uniquement pour un ADMIN)',
  })
  @ApiResponse({ status: 201, description: 'Décision enregistrée.' })
  @ApiResponse({ status: 403, description: 'Rôle ou auteur non autorisé.' })
  @ApiResponse({ status: 409, description: 'Validation déjà traitée.' })
  async decideLiquidationValidation(
    @Param('id') id: string,
    @Body() dto: DecideLiquidationValidationDto,
    @CurrentUser() user: { id: number; role: string },
    @Query('role') role?: LgLiquidationValidatorRole,
  ) {
    const targetRole = this.liquidationValidationService.resolveTargetRole(
      user,
      role,
    );
    return this.liquidationValidationService.decide(
      id,
      targetRole,
      dto.decision,
      dto.commentaire,
      user,
    );
  }

  @Patch(':id/liquidation')
  @Roles('DEMANDEUR', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Resoumettre une liquidation rejetée (réinitialise le circuit)',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du déplacement' })
  @ApiResponse({ status: 200, description: 'Liquidation resoumise.' })
  @ApiResponse({
    status: 422,
    description: 'Aucune ligne rejetée : resoumission impossible.',
  })
  async resubmitLiquidation(
    @Param('id') id: string,
    @Body() dto: ResubmitLiquidationDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.liquidationService.resubmit(id, dto, user);
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
