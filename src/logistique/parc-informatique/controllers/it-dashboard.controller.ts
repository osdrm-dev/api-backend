import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ItDashboardService } from '../services/it-dashboard.service';

@ApiTags('Logistique - Parc Informatique - Dashboard')
@ApiBearerAuth()
@Controller('logistique/parc-informatique/dashboard')
@UseGuards(JwtAuthGuard)
export class ItDashboardController {
  constructor(private readonly dashboardService: ItDashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Tableau de bord du parc informatique' })
  getDashboard() {
    return this.dashboardService.getDashboard();
  }
}
