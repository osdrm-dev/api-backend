import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { BCService } from 'src/purchase/services/bc.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UploadBCDto } from '../dto/bc.dto';

@ApiTags('BC Management')
@ApiBearerAuth('JWT-auth')
@Controller('purchases/:purchaseId/bc')
@UseGuards(JwtAuthGuard)
export class BCController {
  constructor(private readonly bcService: BCService) {}

  @Post('upload')
  @ApiOperation({
    summary: "Uploader le Bon de Commande (1 seul, remplace l'ancien)",
  })
  @ApiParam({ name: 'purchaseId' })
  @ApiBody({ type: UploadBCDto })
  upload(
    @Param('purchaseId') purchaseId: string,
    @CurrentUser('id') userId: number,
    @Body() dto: UploadBCDto,
  ) {
    return this.bcService.uploadBC(purchaseId, userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer le BC actuel' })
  @ApiParam({ name: 'purchaseId' })
  get(@Param('purchaseId') purchaseId: string) {
    return this.bcService.getBC(purchaseId);
  }
}
