import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PVService } from '../services/pv.service';
import { CreatePVDto } from '../dto/create-pv.dto';
import { UpdatePVDto } from '../dto/update-pv.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('purchases/:purchaseId/pv')
@UseGuards(JwtAuthGuard)
export class PVController {
  constructor(private readonly pvService: PVService) {}

  // Créer le PV
  @Post()
  createPV(
    @Param('purchaseId') purchaseId: string,
    @Request() req,
    @Body() dto: CreatePVDto,
  ) {
    return this.pvService.createPV(purchaseId, req.user.id, dto);
  }

  // Modifier le PV (tant qu'il est en DRAFT)
  @Patch()
  updatePV(
    @Param('purchaseId') purchaseId: string,
    @Request() req,
    @Body() dto: UpdatePVDto,
  ) {
    return this.pvService.updatePV(purchaseId, req.user.id, dto);
  }

  // Soumettre le PV pour validation
  @Post('submit')
  submitPV(@Param('purchaseId') purchaseId: string, @Request() req) {
    return this.pvService.submitPV(purchaseId, req.user.id);
  }

  // Récupérer le PV
  @Get()
  getPV(@Param('purchaseId') purchaseId: string) {
    return this.pvService.getPV(purchaseId);
  }
}
