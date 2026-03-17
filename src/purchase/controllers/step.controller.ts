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
import { DocumentStepService } from 'src/purchase/services/step.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

class UploadDocDto {
  @ApiProperty({ example: 'document.pdf' })
  fileName: string;

  @ApiProperty({ example: 'https://storage.example.com/files/document.pdf' })
  fileUrl: string;

  @ApiProperty({ example: 1024000 })
  fileSize: number;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;
}

class UploadBRDto extends UploadDocDto {
  @ApiProperty({
    required: false,
    example: 'Quantité livrée partielle, écart de prix négocié',
    description: 'Optionnel — requis si montant BR ≠ BC',
  })
  justification?: string;
}

interface DocControllerClass {
  new (svc: DocumentStepService): {
    upload(id: string, req: any, dto: any): any;
    get(id: string): any;
    submit(id: string, req: any): any;
  };
}

function makeController(
  step: 'BR' | 'INVOICE' | 'DAP' | 'PROOF_OF_PAYMENT',
  tag: string,
  routePath: string,
  DtoClass: any = UploadDocDto,
): DocControllerClass {
  @ApiTags(tag)
  @ApiBearerAuth('JWT-auth')
  @Controller(`purchases/:purchaseId/${routePath}`)
  @UseGuards(JwtAuthGuard)
  class DocController {
    constructor(private readonly svc: DocumentStepService) {}

    @Post('upload')
    @ApiOperation({ summary: `Uploader le document (${step})` })
    @ApiParam({ name: 'purchaseId' })
    @ApiBody({ type: DtoClass })
    upload(@Param('purchaseId') id: string, @Request() req, @Body() dto: any) {
      return this.svc.upload(step, id, req.user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: `Récupérer le document (${step})` })
    @ApiParam({ name: 'purchaseId' })
    get(@Param('purchaseId') id: string) {
      return this.svc.get(step, id);
    }

    @Post('submit')
    @ApiOperation({ summary: `Soumettre pour validation (${step})` })
    @ApiParam({ name: 'purchaseId' })
    submit(@Param('purchaseId') id: string, @Request() req) {
      return this.svc.submit(id, req.user.id);
    }
  }

  return DocController;
}

export const BRController = makeController(
  'BR',
  'BR Management',
  'br',
  UploadBRDto,
);
export const InvoiceController = makeController(
  'INVOICE',
  'Invoice Management',
  'invoice',
);
export const DAPController = makeController('DAP', 'DAP Management', 'dap');
export const ProofOfPaymentController = makeController(
  'PROOF_OF_PAYMENT',
  'Payment Management',
  'proof-of-payment',
);
