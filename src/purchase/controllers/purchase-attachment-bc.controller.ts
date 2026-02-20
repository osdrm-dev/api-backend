import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { PurchaseAttachmentBcService } from '../services/purchase-attachment-bc.service';
import { UploadBcDto } from '../dto/upload-bc.dto';
import { Role } from '@prisma/client';

interface AuthenticatedUser {
  id: number;
  role: Role;
}

@Controller('purchases/:id/attachments')
export class PurchaseAttachmentBcController {
  constructor(
    private readonly attachmentService: PurchaseAttachmentBcService,
  ) {}

  @Post('/bc')
  async uploadBC(
    @Param('id') purchaseId: string,
    @Body() dto: UploadBcDto,
    @Req() req: any,
  ) {
    const user = req.user as AuthenticatedUser;
    return this.attachmentService.uploadBcAttachment(user, purchaseId, dto);
  }

  /** * Upload plusieurs BC */
  @Post('bc/multiple')
  async uploadMultipleBCs(
    @Param('id') purchaseId: string,
    @Body() dtos: UploadBcDto[],
    @Req() req: any,
  ) {
    const user = req.user as AuthenticatedUser;
    return this.attachmentService.uploadMultipleBCs(user, purchaseId, dtos);
  }

  /** * Lister les BC d'une DA */
  @Get('bc')
  async listBCs(@Param('id') purchaseId: string, @Req() req: any) {
    const userId = (req.user as AuthenticatedUser).id;
    return this.attachmentService.listBCs(purchaseId, userId);
  }

  @Delete('bc/:bcId')
  async deleteBC(
    @Param('id') purchaseId: string,
    @Param('bcId') bcId: string,
    @Req() req: any,
  ) {
    const userId = (req.user as AuthenticatedUser).id;
    return this.attachmentService.deleteBCAttachment(userId, purchaseId, bcId);
  }

  /** * Valider le BC et passer à l'étape suivante */
  @Post('bc/validate')
  async validateBC(@Param('id') purchaseId: string, @Req() req: any) {
    const userId = (req.user as AuthenticatedUser).id;
    return this.attachmentService.validateBCAndProceed(purchaseId, userId);
  }
}
