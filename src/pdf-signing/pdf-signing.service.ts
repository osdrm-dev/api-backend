import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'prisma/prisma.service';
import { SigningStatus } from '@prisma/client';

export const PDF_SIGNING_QUEUE = 'pdf-signing';
export const PDF_SIGNING_JOB = 'sign';

@Injectable()
export class PdfSigningService {
  constructor(
    @InjectQueue(PDF_SIGNING_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async enqueue(
    attachmentId: string,
    params: {
      signedById: number;
      specimenId: number;
      pageNumber: number;
      positionX: number;
      positionY: number;
      signatureWidth: number;
    },
  ): Promise<string> {
    const job = await this.queue.add(PDF_SIGNING_JOB, {
      attachmentId,
      ...params,
    });
    return String(job.id);
  }

  async getStatus(
    attachmentId: string,
  ): Promise<{ signingStatus: SigningStatus | null; jobId: string | null }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: { signingStatus: true, jobId: true },
    });

    if (!attachment) {
      throw new NotFoundException('Pièce jointe introuvable');
    }

    return {
      signingStatus: attachment.signingStatus,
      jobId: attachment.jobId,
    };
  }
}
