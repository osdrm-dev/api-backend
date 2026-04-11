import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { StatisticsService } from '../services/statistics.service';
import { KpiService } from '../services/kpi.service';
import { KpiQueryDto } from '../dto/kpi-query.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('Statistics')
@Controller('statistics')
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly kpiService: KpiService,
  ) {}

  @Get('purchases/total')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Get total purchases count',
    description:
      'Retrieve the total number of purchases. If user is not ADMIN, only count purchases created by the current user.',
  })
  @ApiOkResponse({
    description: 'Total purchases count',
    schema: {
      example: {
        totalPurchases: 25,
        filteredByUser: true,
      },
    },
  })
  async getTotalPurchasesCount(@Req() req: any) {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.statisticsService.getPurchaseCount(user);
  }

  @Get('kpi')
  @Roles(Role.ADMIN, Role.CFO, Role.CEO, Role.DP, Role.CPR, Role.RFR)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Tableau de bord KPI achats',
    description:
      "Retourne les 5 indicateurs clés de performance sur les dossiers d'achats : délai de soumission, délai acheteur, volume par marché, volume par acheteur/région, évaluation fournisseur. Réservé aux rôles décisionnels.",
  })
  @ApiOkResponse({
    description: 'Données KPI agrégées',
    schema: {
      example: {
        submissionDelay: {
          avgDelayDays: 4.5,
          medianDelayDays: 3.0,
          complianceRate: 72.5,
          monthlySeries: [{ month: '2025-01', avgDelay: 3.8, count: 12 }],
        },
        buyerDelay: {
          series: [{ category: 'Fournitures', avgDelayDays: 6.2, count: 8 }],
        },
        volumeByMarket: {
          total: 5000000,
          items: [
            {
              marketType: 'Marché public',
              totalAmount: 3200000,
              count: 14,
              percentage: 64.0,
            },
          ],
        },
        volumeByBuyerRegion: {
          buyers: [
            {
              buyerName: 'Jean Dupont',
              regions: [
                { region: 'Analamanga', totalAmount: 1200000, count: 5 },
              ],
            },
          ],
        },
        supplierEvaluation: {
          suppliers: [
            {
              id: 'clx...',
              name: 'Fournisseur A',
              globalRating: 4.2,
              deliveryRating: 4.0,
              qualityRating: 4.5,
              serviceRating: 4.1,
              complianceScore: 66.7,
              evaluationCount: 3,
            },
          ],
        },
      },
    },
  })
  async getKpis(@Query() query: KpiQueryDto) {
    return this.kpiService.getAllKpis(query);
  }
}
