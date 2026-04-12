import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiPropertyOptional,
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DocumentStepService,
  DocStep,
} from 'src/purchase/services/step.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { console } from 'inspector';

export class UploadDocDto {
  @ApiProperty({ example: 'document.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: '/files/document.pdf' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ example: 1024000 })
  @IsNumber()
  @Type(() => Number)
  fileSize: number;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiPropertyOptional({
    example: 42,
    description: 'ID du fichier uploadé via /files/upload',
  })
  @IsInt()
  @IsOptional()
  fileId?: number;
}

export class UploadBRDto extends UploadDocDto {
  @ApiPropertyOptional({
    example: 'Quantité livrée partielle, écart de prix négocié',
    description: 'Optionnel — requis si montant BR ≠ BC',
  })
  @IsString()
  @IsOptional()
  justification?: string;
}

function makeController(
  step: DocStep,
  tag: string,
  routePath: string,
  DtoClass: any = UploadDocDto,
) {
  @ApiTags(tag)
  @ApiBearerAuth('JWT-auth')
  @Controller(`purchases/:purchaseId/${routePath}`)
  @UseGuards(JwtAuthGuard)
  class DocController {
    constructor(public readonly svc: DocumentStepService) {}

    @Post('upload')
    @ApiOperation({ summary: `Uploader le document (${step})` })
    @ApiParam({ name: 'purchaseId' })
    @ApiBody({ type: DtoClass })
    upload(
      @Param('purchaseId') id: string,
      @CurrentUser('id') userId: number,
      @Body() dto: typeof DtoClass,
    ) {
      return this.svc.upload(step, id, userId, dto);
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
    submit(@Param('purchaseId') id: string, @CurrentUser('id') userId: number) {
      return this.svc.submit(step, id, userId);
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
