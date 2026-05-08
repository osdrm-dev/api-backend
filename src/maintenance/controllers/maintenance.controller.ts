import {
  Body,
  Controller,
  Delete,
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
import { MaintenanceService } from '../services/maintenance.service';
import { MaintenanceStatusService } from '../services/maintenance-status.service';
import { TriggerDaService } from '../services/trigger-da.service';
import { CreateMaintenanceRequestDto } from '../dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from '../dto/update-maintenance-request.dto';
import { UpdateMaintenanceStatusDto } from '../dto/update-maintenance-status.dto';
import { FilterMaintenanceDto } from '../dto/filter-maintenance.dto';
import { TriggerDaDto } from '../dto/trigger-da.dto';

@ApiTags('Logistique - Entretien / Réparation')
@ApiBearerAuth()
@Controller('logistique/entretien')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly statusService: MaintenanceStatusService,
    private readonly triggerDaService: TriggerDaService,
  ) {}

  @Post()
  @Roles('DEMANDEUR')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Créer une demande de maintenance' })
  create(
    @Body() dto: CreateMaintenanceRequestDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.maintenanceService.createRequest(dto, userId);
  }

  // Static paths BEFORE /:id
  @Get('mes-demandes')
  @Roles('DEMANDEUR')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Lister mes demandes de maintenance' })
  getMyRequests(
    @Query() query: FilterMaintenanceDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.maintenanceService.getAllForRequestor(userId, query);
  }

  @Get('stats')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Statistiques des demandes de maintenance' })
  getStats() {
    return this.maintenanceService.getStats();
  }

  @Get()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Lister toutes les demandes de maintenance (admin)',
  })
  getAll(@Query() query: FilterMaintenanceDto) {
    return this.maintenanceService.getAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une demande de maintenance par son ID' })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    if (user.role === 'ADMIN') {
      return this.maintenanceService.getRequestAdmin(id);
    }
    return this.maintenanceService.getRequestForRequestor(id, user.id);
  }

  @Patch(':id')
  @Roles('DEMANDEUR')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Modifier une demande de maintenance (demandeur)' })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceRequestDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.maintenanceService.updateRequestor(id, dto, userId);
  }

  @Delete(':id')
  @Roles('DEMANDEUR')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Supprimer une demande de maintenance (demandeur)' })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: number) {
    return this.maintenanceService.softDeleteRequest(id, userId);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Changer le statut d'une demande (admin)" })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceStatusDto,
    @CurrentUser('id') adminUserId: number,
  ) {
    return this.statusService.updateStatus(id, dto, adminUserId);
  }

  @Post(':id/trigger-da')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Déclencher une DA liée à une demande de maintenance (admin)',
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  triggerDa(
    @Param('id') id: string,
    @Body() dto: TriggerDaDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.triggerDaService.triggerDA(id, userId, dto);
  }
}
