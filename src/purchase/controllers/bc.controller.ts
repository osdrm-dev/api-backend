import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BCService } from 'src/purchase/services/bc.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('BC Management')
@ApiBearerAuth('JWT-auth')
@Controller('purchases/:purchaseId/bc')
@UseGuards(JwtAuthGuard)
export class BCController {
  constructor(private readonly bcService: BCService) {}

  @Post('generate')
  @ApiOperation({
    summary:
      'Générer le(s) Bon(s) de Commande PDF depuis les articles retenus du PV (1 par fournisseur) et lancer la validation BC',
  })
  @ApiParam({ name: 'purchaseId' })
  generate(
    @Param('purchaseId') purchaseId: string,
    @CurrentUser('id') userId: number,
  ) {
    return this.bcService.generateBC(purchaseId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer le BC actuel' })
  @ApiParam({ name: 'purchaseId' })
  get(@Param('purchaseId') purchaseId: string) {
    return this.bcService.getBC(purchaseId);
  }
}
