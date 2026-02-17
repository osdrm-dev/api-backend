import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { StatisticsService } from '../services/statistics.service';
import { RolesGuard } from '../guards/roles.guard';

@ApiTags('Statistics')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

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
    return this.statisticsService.getPurchaseCount(user);
  }
}
