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
import { LgSettlementValidatorRole } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { MissionService } from '../services/mission.service';
import { MissionStatusService } from '../services/mission-status.service';
import { MissionAssignService } from '../services/mission-assign.service';
import { MissionConfirmService } from '../services/mission-confirm.service';
import { MissionTriggerDaService } from '../services/mission-trigger-da.service';
import { MissionSettlementService } from '../services/mission-settlement.service';
import { CreateMissionDto } from '../dto/create-mission.dto';
import { FilterMissionDto } from '../dto/filter-mission.dto';
import { UpdateMissionStatusDto } from '../dto/update-mission-status.dto';
import { AssignVehicleDto } from '../dto/assign-vehicle.dto';
import { ConfirmMissionDto } from '../dto/confirm-mission.dto';
import { TriggerDaMissionDto } from '../dto/trigger-da-mission.dto';
import { CreateSettlementDto } from '../dto/create-settlement.dto';
import { DecideSettlementValidationDto } from '../dto/decide-settlement-validation.dto';
import { ResubmitSettlementDto } from '../dto/resubmit-settlement.dto';
import { SettlementValidationService } from '../services/settlement-validation.service';

@ApiTags('Logistique - Trajets')
@ApiBearerAuth()
@Controller('logistique/missions')
@UseGuards(JwtAuthGuard)
export class MissionController {
  constructor(
    private readonly missionService: MissionService,
    private readonly statusService: MissionStatusService,
    private readonly assignService: MissionAssignService,
    private readonly confirmService: MissionConfirmService,
    private readonly triggerDaService: MissionTriggerDaService,
    private readonly settlementService: MissionSettlementService,
    private readonly settlementValidationService: SettlementValidationService,
  ) {}

  @Post()
  @Roles('DEMANDEUR', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Soumettre une demande de trajet' })
  async create(
    @Body() dto: CreateMissionDto,
    @CurrentUser() user: { id: number; role: string },
    @Query('bypassDeadline') bypassDeadline?: string,
  ) {
    const bypass = user.role === 'ADMIN' && bypassDeadline === 'true';
    return this.missionService.create(dto, user.id, bypass);
  }

  // GET stats must be before GET /:id
  @Get('stats')
  @Roles('GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'KPIs des trajets par statut' })
  async getStats() {
    return this.missionService.getStats();
  }

  // GET mes-demandes must be before GET /:id
  @Get('my-missions')
  @Roles('DEMANDEUR', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Lister mes demandes de trajet' })
  async getMyRequests(
    @CurrentUser() user: { id: number },
    @Query() query: FilterMissionDto,
  ) {
    return this.missionService.findMyRequests(user.id, query);
  }

  @Get()
  @Roles('GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Lister toutes les demandes de trajet' })
  async getAll(@Query() query: FilterMissionDto) {
    return this.missionService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer une demande de trajet par son identifiant',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.missionService.findById(id, user);
  }

  @Patch(':id/status')
  @Roles('GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Changer le statut d'une demande" })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMissionStatusDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.statusService.updateStatus(id, dto, user.id);
  }

  @Patch(':id/assign-vehicle')
  @Roles('GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Affecter un véhicule à une demande' })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
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
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmMissionDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.confirmService.confirm(id, dto, user.id);
  }

  @Post(':id/trigger-da')
  @Roles('GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Déclencher une DA de location de véhicule' })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async triggerDA(
    @Param('id') id: string,
    @Body() dto: TriggerDaMissionDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.triggerDaService.triggerDA(id, dto, user.id);
  }

  @Post(':id/settlement')
  @Roles('DEMANDEUR', 'GESTIONNAIRE_PARC', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Soumettre le formulaire de liquidation' })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async submitSettlement(
    @Param('id') id: string,
    @Body() dto: CreateSettlementDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.settlementService.submit(id, dto, user.id);
  }

  @Get(':id/settlement')
  @ApiOperation({
    summary: "Récupérer la liquidation d'un trajet (avec ses validations)",
  })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async getSettlement(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    // ownership check via findById
    await this.missionService.findById(id, user);
    return this.settlementService.getSettlement(id);
  }

  @Get(':id/settlement/validations')
  @ApiOperation({
    summary: 'Détail des 3 validations (DEMANDEUR, OM, CFO) de la liquidation',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  @ApiResponse({
    status: 200,
    description: 'Liste des 3 lignes de validation.',
  })
  @ApiResponse({ status: 404, description: 'Aucune liquidation soumise.' })
  async getSettlementValidations(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    // ownership check via findById
    await this.missionService.findById(id, user);
    return this.settlementValidationService.getValidationDetail(id);
  }

  @Post(':id/settlement/validations/decision')
  @Roles('DEMANDEUR', 'OM', 'CFO', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary:
      'Valider ou rejeter la ligne de validation correspondant à son rôle',
    description:
      "Le rôle ciblé est déduit du rôle de l'utilisateur courant (DEMANDEUR → sa propre ligne, OM, CFO). " +
      'Un ADMIN doit préciser le rôle ciblé via le query param `role`.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: LgSettlementValidatorRole,
    description: 'Rôle ciblé (obligatoire uniquement pour un ADMIN)',
  })
  @ApiResponse({ status: 201, description: 'Décision enregistrée.' })
  @ApiResponse({ status: 403, description: 'Rôle ou auteur non autorisé.' })
  @ApiResponse({ status: 409, description: 'Validation déjà traitée.' })
  async decideSettlementValidation(
    @Param('id') id: string,
    @Body() dto: DecideSettlementValidationDto,
    @CurrentUser() user: { id: number; role: string },
    @Query('role') role?: LgSettlementValidatorRole,
  ) {
    const targetRole = this.settlementValidationService.resolveTargetRole(
      user,
      role,
    );
    return this.settlementValidationService.decide(
      id,
      targetRole,
      dto.decision,
      dto.comment,
      user,
    );
  }

  @Patch(':id/settlement')
  @Roles('DEMANDEUR', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Resoumettre une liquidation rejetée (réinitialise le circuit)',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  @ApiResponse({ status: 200, description: 'Liquidation resoumise.' })
  @ApiResponse({
    status: 422,
    description: 'Aucune ligne rejetée : resoumission impossible.',
  })
  async resubmitSettlement(
    @Param('id') id: string,
    @Body() dto: ResubmitSettlementDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.settlementService.resubmit(id, dto, user);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Annuler une demande de trajet' })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.missionService.cancel(id, user);
  }
}
