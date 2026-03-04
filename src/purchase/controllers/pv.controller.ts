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

  @Post()
  createPV(
    @Param('purchaseId') purchaseId: string,
    @Request() req,
    @Body() dto: CreatePVDto,
  ) {
    return this.pvService.createPV(purchaseId, req.user.id, dto);
  }

  @Patch()
  updatePV(
    @Param('purchaseId') purchaseId: string,
    @Request() req,
    @Body() dto: UpdatePVDto,
  ) {
    return this.pvService.updatePV(purchaseId, req.user.id, dto);
  }

  @Post('submit')
  submitPV(@Param('purchaseId') purchaseId: string, @Request() req) {
    return this.pvService.submitPV(purchaseId, req.user.id);
  }

  @Get()
  getPV(@Param('purchaseId') purchaseId: string) {
    return this.pvService.getPV(purchaseId);
  }
}
