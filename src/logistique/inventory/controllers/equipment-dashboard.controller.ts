import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { EquipmentDashboardService } from '../services/equipment-dashboard.service';

@ApiTags('Logistique - Inventaire matériel - Dashboard')
@ApiBearerAuth()
@Controller('logistique/inventory/dashboard')
@UseGuards(JwtAuthGuard)
export class EquipmentDashboardController {
  constructor(private readonly dashboardService: EquipmentDashboardService) {}

  @Get()
  @ApiOperation({ summary: "Tableau de bord de l'inventaire matériel" })
  getDashboard() {
    return this.dashboardService.getDashboard();
  }
}
