import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
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
      "Récupère les DA de l'acheteur connecté avec status PUBLISHED/AWAITING_DOCUMENTS et currentStep QR pour upload des devis",
  })
  async getQRPending(
    @CurrentUser('id') userId: number,
    @Query() filters: FilterPurchaseDto,
  ) {
    return this.queryService.findValidatedForQR(filters, userId);
  }
}
