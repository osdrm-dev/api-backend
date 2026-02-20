import { Body, Controller, Delete, Param, Post, Req } from '@nestjs/common';
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

  @Delete('bc/:bcId')
  async deleteBC(
    @Param('id') purchaseId: string,
    @Param('bcId') bcId: string,
    @Req() req: any,
  ) {
    const userId = (req.user as AuthenticatedUser).id;
    return this.attachmentService.deleteBCAttachment(userId, purchaseId, bcId);
  }
}
