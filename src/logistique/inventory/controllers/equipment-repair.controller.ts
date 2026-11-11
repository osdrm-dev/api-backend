import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { FilterMaintenanceDto } from 'src/maintenance/dto/filter-maintenance.dto';
import { EquipmentRepairService } from '../services/equipment-repair.service';
import { CreateEquipmentRepairDto } from '../dto/create-equipment-repair.dto';

/**
 * Déclaration et suivi des pannes de matériel. Le détail, les commentaires et le
 * changement de statut passent par les routes Entretien (`logistique/entretien/:id…`).
 */
@ApiTags('Logistique - Inventaire matériel - Réparations')
@ApiBearerAuth()
@Controller('logistique/inventory/repairs')
@UseGuards(JwtAuthGuard)
export class EquipmentRepairController {
  constructor(private readonly repairService: EquipmentRepairService) {}

  @Post()
  @ApiOperation({ summary: 'Déclarer une panne sur un matériel attribué' })
  create(
    @Body() dto: CreateEquipmentRepairDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.repairService.create(user, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Mes déclarations de panne' })
  findMine(
    @Query() query: FilterMaintenanceDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.repairService.findMine(userId, query);
  }

  @Get('my-equipments')
  @ApiOperation({ summary: 'Matériels qui me sont attribués' })
  findMyEquipments(@CurrentUser('id') userId: number) {
    return this.repairService.findMyEquipments(userId);
  }

  @Get()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Toutes les réparations de matériel (ADMIN)' })
  findAll(@Query() query: FilterMaintenanceDto) {
    return this.repairService.findAll(query);
  }
}
