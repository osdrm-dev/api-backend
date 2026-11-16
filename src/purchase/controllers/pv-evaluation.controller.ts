import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PVEvaluationService } from '../services/pv-evaluation.service';
import {
  SavePVEvaluationDto,
  WaivePVEvaluationDto,
} from '../dto/pv-evaluation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('PV Evaluations')
@ApiBearerAuth('JWT-auth')
@ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
@Controller('purchases/:purchaseId/pv/evaluations')
@UseGuards(JwtAuthGuard)
export class PVEvaluationController {
  constructor(private readonly service: PVEvaluationService) {}

  @Get()
  @ApiOperation({ summary: 'Toutes les grilles (acheteur de la DA et ADMIN)' })
  listAll(@Param('purchaseId') purchaseId: string, @Request() req) {
    return this.service.listAll(purchaseId, req.user);
  }

  @Get('status')
  @ApiOperation({ summary: 'Avancement des evaluations (sans reponses)' })
  getStatus(@Param('purchaseId') purchaseId: string, @Request() req) {
    return this.service.getStatus(purchaseId, req.user);
  }

  @Get('me')
  @ApiOperation({ summary: "Ma grille d'evaluation" })
  getMine(@Param('purchaseId') purchaseId: string, @Request() req) {
    return this.service.getMine(purchaseId, req.user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Enregistrer ma grille (brouillon)' })
  saveMine(
    @Param('purchaseId') purchaseId: string,
    @Body() dto: SavePVEvaluationDto,
    @Request() req,
  ) {
    return this.service.saveMine(purchaseId, req.user.id, dto);
  }

  @Post('me/submit')
  @ApiOperation({ summary: 'Soumettre ma grille' })
  submitMine(@Param('purchaseId') purchaseId: string, @Request() req) {
    return this.service.submitMine(purchaseId, req.user.id);
  }

  @Post(':userId/waive')
  @ApiOperation({ summary: 'Dispenser un evaluateur (ADMIN)' })
  @ApiParam({ name: 'userId', description: "ID de l'evaluateur" })
  waive(
    @Param('purchaseId') purchaseId: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: WaivePVEvaluationDto,
    @Request() req,
  ) {
    return this.service.waive(purchaseId, req.user, userId, dto);
  }
}
