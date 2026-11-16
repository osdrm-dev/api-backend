import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PVEvaluationService } from '../services/pv-evaluation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('PV Evaluations')
@ApiBearerAuth('JWT-auth')
@Controller('pv-evaluations')
@UseGuards(JwtAuthGuard)
export class PendingPVEvaluationController {
  constructor(private readonly service: PVEvaluationService) {}

  @Get('pending')
  @ApiOperation({ summary: 'DA dont je dois remplir ma grille PV' })
  listPending(@Request() req) {
    return this.service.listPendingForUser(req.user.id);
  }
}
