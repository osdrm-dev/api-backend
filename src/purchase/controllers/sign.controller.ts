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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DocumentStepService, DocStep } from '../services/step.service';
import { PdfSigningService } from '../../pdf-signing/pdf-signing.service';
import { RequestSigningDto } from '../dto/request-signing.dto';

@ApiTags('Signature PDF')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('purchases/:purchaseId')
export class SignController {
  constructor(
    private readonly documentStepService: DocumentStepService,
    private readonly pdfSigningService: PdfSigningService,
  ) {}

  @Post(':step/attachments/:attachmentId/sign')
  @ApiOperation({
    summary: 'Signer une pièce jointe (enqueue job)',
    description:
      'Enfile un job de signature asynchrone. Retourne un jobId à poller via GET .../sign/status.',
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiParam({ name: 'step', description: 'Étape (ex: dap)', example: 'dap' })
  @ApiParam({ name: 'attachmentId', description: 'ID de la pièce jointe' })
  @ApiBody({ type: RequestSigningDto })
  sign(
    @Param('purchaseId') purchaseId: string,
    @Param('step') step: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: { user: { id: number } },
    @Body() dto: RequestSigningDto,
  ) {
    return this.documentStepService.signStep(
      step.toUpperCase() as DocStep,
      purchaseId,
      attachmentId,
      req.user.id,
      dto,
    );
  }

  @Get(':step/attachments/:attachmentId/sign/status')
  @ApiOperation({
    summary: 'Statut du job de signature',
    description:
      'Retourne le SigningStatus courant (PENDING | PROCESSING | DONE | FAILED) et le jobId.',
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiParam({ name: 'step', description: 'Étape (ex: dap)', example: 'dap' })
  @ApiParam({ name: 'attachmentId', description: 'ID de la pièce jointe' })
  getStatus(@Param('attachmentId') attachmentId: string) {
    return this.pdfSigningService.getStatus(attachmentId);
  }
}
