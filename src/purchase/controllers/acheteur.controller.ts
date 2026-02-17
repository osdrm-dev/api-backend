import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PurchaseQueryService } from '../../purchaseValidation/services/purchase-query.service';
import { FilterPurchaseDto } from '../../purchaseValidation/dto/filter-purchase.dto';

@ApiTags('Acheteur')
@ApiBearerAuth('JWT-auth')
@Controller('acheteur/purchases')
@UseGuards(JwtAuthGuard)
export class AcheteurController {
  constructor(private readonly queryService: PurchaseQueryService) {}

  @Get('qr-pending')
  @ApiOperation({
    summary: 'Liste des DA validées en attente de devis (étape QR)',
    description:
      'Récupère toutes les DA avec status VALIDATED et currentStep QR pour upload des devis',
  })
  async getQRPending(@Query() filters: FilterPurchaseDto) {
    return this.queryService.findValidatedForQR(filters);
  }
}
