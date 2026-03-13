import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import { BCService } from 'src/purchase/services/bc.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

class UploadBCDto {
  @ApiProperty({ example: 'bon-de-commande.pdf' })
  fileName: string;

  @ApiProperty({ example: 'https://storage.example.com/files/bc-001.pdf' })
  fileUrl: string;

  @ApiProperty({ example: 1024000 })
  fileSize: number;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;
}

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
    @Request() req,
    @Body() dto: UploadBCDto,
  ) {
    return this.bcService.uploadBC(purchaseId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer le BC actuel' })
  @ApiParam({ name: 'purchaseId' })
  get(@Param('purchaseId') purchaseId: string) {
    return this.bcService.getBC(purchaseId);
  }
}
