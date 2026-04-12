import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from 'prisma/prisma.service';
import { PurchaseStep, SigningStatus, ValidatorRole } from '@prisma/client';
import type { File as MulterFile } from 'multer';
import { FileStorageService } from 'src/storage/services/file-storage.service';
import { ValidationActionService } from 'src/purchaseValidation/services/validation-action.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { PdfLibService } from './pdf-lib.service';
import { PDF_SIGNING_QUEUE, PDF_SIGNING_JOB } from './pdf-signing.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';

interface PdfSigningJobData {
  attachmentId: string;
  signedById: number;
  specimenId: number;
  pageNumber: number;
  positionX: number;
  positionY: number;
  signatureWidth: number;
}

@Processor(PDF_SIGNING_QUEUE)
export class PdfSigningProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfSigningProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly pdfLib: PdfLibService,
    private readonly validationAction: ValidationActionService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<PdfSigningJobData>): Promise<void> {
    if (job.name !== PDF_SIGNING_JOB) return;
    const { attachmentId } = job.data;

    try {
      await this.handleSign(job);
    } catch (error) {
      this.logger.error(
        `Job ${job.id} failed for attachment ${attachmentId}: ${error.message}`,
      );
      await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: { signingStatus: SigningStatus.FAILED },
      });
      throw error;
    }
  }

  private async handleSign(job: Job<PdfSigningJobData>): Promise<void> {
    const {
      attachmentId,
      signedById,
      specimenId,
      pageNumber,
      positionX,
      positionY,
      signatureWidth,
    } = job.data;

    // 1. Set PROCESSING
    await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: { signingStatus: SigningStatus.PROCESSING },
    });

    // 2. Load attachment
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    console.log(attachment);

    if (!attachment || !attachment.fileId) {
      throw new Error(
        `Attachment ${attachmentId} is missing required signing data`,
      );
    }

    // 3. Load signer name and specimen
    const signer = await this.prisma.user.findUnique({
      where: { id: signedById },
      select: { name: true },
    });

    const specimen = await this.prisma.signatureSpecimen.findUnique({
      where: { id: specimenId },
      include: { file: true },
    });

    if (!specimen) {
      throw new Error(`Specimen ${specimenId} not found`);
    }

    // 4. Determine base PDF: last signed version, or fileId (the original) if no signatures yet
    const versions = (attachment.versions as {
      signatures: {
        fileId: number;
        signedBy: string;
        specimenId: number;
        signedAt: string;
        signedHash: string;
      }[];
    } | null) ?? { signatures: [] };
    const baseFileId =
      versions.signatures.length > 0
        ? versions.signatures[versions.signatures.length - 1].fileId
        : attachment.fileId;

    // 5. Get PDF buffer (base document to sign)
    const pdfBuffer = await this.fileStorage.getBuffer(baseFileId);

    // 6. Get signature image buffer
    const imageBuffer = await this.fileStorage.getBuffer(specimen.fileId);
    const imageMimeType = specimen.file.mimeType;

    // 7. Sign PDF using params from job data
    const { signedBuffer, hashAfter } = await this.pdfLib.embedSignature(
      pdfBuffer,
      imageBuffer,
      imageMimeType,
      {
        pageNumber: pageNumber ?? 1,
        positionX: positionX ?? 0,
        positionY: positionY ?? 0,
        signatureWidth: signatureWidth ?? 0.2,
      },
    );

    // 8. Save signed PDF as new File record
    const originalFile = await this.fileStorage.getById(attachment.fileId);
    const multerFile: MulterFile = {
      fieldname: 'file',
      originalname: `signed-${originalFile.originalName}`,
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: signedBuffer.length,
      buffer: signedBuffer,
    } as MulterFile;

    const signedFile = await this.fileStorage.upload(multerFile, {
      userId: signedById,
      skipOptimization: true,
    });

    // 9. Append signature entry to versions.signatures; attachment.fileId stays as original
    const signedAt = new Date();
    const newVersions = {
      signatures: [
        ...versions.signatures,
        {
          fileId: signedFile.id,
          signedBy: signer?.name ?? String(signedById),
          specimenId,
          signedAt,
          signedHash: hashAfter,
          fileUrl: signedFile.url,
        },
      ],
    };

    await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        signingStatus: SigningStatus.DONE,
        versions: newVersions,
        signedHash: hashAfter,
        signedAt: new Date(),
      },
    });

    this.logger.log(
      `Attachment ${attachmentId} signed successfully → File #${signedFile.id}`,
    );

    // 8. Validate the workflow step (signing = validation)
    await this.runValidation(attachment.purchaseId, signedById);

    // 10. Notify next validators
    await this.notifyNextValidators(attachment.purchaseId, attachment.id);
  }

  private async runValidation(
    purchaseId: string,
    userId: number,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!user) return;

      await this.validationAction.validate({
        purchaseId,
        userId,
        userRole: user.role as unknown as ValidatorRole,
      });
    } catch (error) {
      this.logger.error(
        `Workflow validation failed for purchase ${purchaseId}: ${error.message}`,
      );
      // Don't rethrow — signing succeeded; workflow failure is recoverable separately
    }
  }

  private async notifyNextValidators(
    purchaseId: string,
    attachmentId: string,
  ): Promise<void> {
    try {
      const purchase = await this.prisma.purchase.findUnique({
        where: { id: purchaseId },
        select: { reference: true },
      });

      const workflow = await this.prisma.validationWorkflow.findFirst({
        where: { purchaseId, step: PurchaseStep.DAP },
        include: {
          validators: {
            where: { isValidated: false },
            orderBy: { order: 'asc' },
            take: 1,
            include: { user: { select: { email: true } } },
          },
        },
      });

      const nextValidator = workflow?.validators[0];
      if (!nextValidator?.user?.email) return;

      await this.notificationService.createNotification(
        OSDRM_PROCESS_EVENT.DPA_CREATED,
        [nextValidator.user.email],
        purchaseId,
        { reference: purchase?.reference ?? purchaseId, attachmentId },
        true,
      );
    } catch (error) {
      this.logger.error(
        `Notification failed for purchase ${purchaseId}: ${error.message}`,
      );
    }
  }
}
