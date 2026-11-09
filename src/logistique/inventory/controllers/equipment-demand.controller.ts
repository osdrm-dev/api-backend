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
import { EquipmentDemandService } from '../services/equipment-demand.service';
import { EquipmentTriggerDaService } from '../services/equipment-trigger-da.service';
import { CreateEquipmentDemandDto } from '../dto/create-equipment-demand.dto';
import { UpdateEquipmentDemandStatusDto } from '../dto/update-equipment-demand-status.dto';
import { FilterEquipmentDemandDto } from '../dto/filter-equipment-demand.dto';
import { TriggerDaDto } from '../dto/trigger-da.dto';

@ApiTags('Logistique - Inventaire matériel - Demandes')
@ApiBearerAuth()
@Controller('logistique/inventory/demands')
@UseGuards(JwtAuthGuard)
export class EquipmentDemandController {
  constructor(
    private readonly demandService: EquipmentDemandService,
    private readonly triggerDaService: EquipmentTriggerDaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les demandes de matériel' })
  findAll(
    @Query() query: FilterEquipmentDemandDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    if (user.role === 'ADMIN') {
      return this.demandService.findAll(query);
    }
    return this.demandService.findAllForRequestor(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une demande de matériel' })
  create(
    @Body() dto: CreateEquipmentDemandDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.demandService.create(dto, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une demande de matériel par son ID' })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  findById(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    if (user.role === 'ADMIN') {
      return this.demandService.findById(id);
    }
    return this.demandService.findByIdForUser(id, user.id);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Changer le statut d'une demande (admin)" })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDemandStatusDto,
    @CurrentUser('id') adminUserId: number,
  ) {
    return this.demandService.updateStatus(id, dto, adminUserId);
  }

  @Post(':id/trigger-da')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Déclencher une DA liée à une demande de matériel (admin)',
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  triggerDa(
    @Param('id') id: string,
    @Body() dto: TriggerDaDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.triggerDaService.triggerForDemand(id, userId, dto);
  }
}
