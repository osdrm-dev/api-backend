/**
 * Integration tests for the pdf-signing module.
 *
 * Strategy: compile the NestJS TestingModule with the real service/processor
 * classes but with every external dependency replaced by a mock.  No Redis
 * connection is needed because we provide a mock queue via getQueueToken and
 * never call moduleRef.init() (which is what would start the BullMQ Worker).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { SigningStatus } from '@prisma/client';

import { PrismaService } from 'prisma/prisma.service';
import { FileStorageService } from 'src/storage/services/file-storage.service';
import { ValidationActionService } from 'src/purchaseValidation/services/validation-action.service';
import { NotificationService } from 'src/notification/services/nofitication.service';

import { PdfLibService } from './pdf-lib.service';
import {
  PdfSigningService,
  PDF_SIGNING_QUEUE,
  PDF_SIGNING_JOB,
} from './pdf-signing.service';
import { PdfSigningProcessor } from './pdf-signing.processor';

// ── Minimal valid PNG (1×1 transparent) ──────────────────────────────────────
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=',
  'base64',
);

async function buildPdfBuffer(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  return Buffer.from(await doc.save());
}

// ── Shared mock factories ─────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    attachment: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
    purchase: {
      findUnique: jest.fn().mockResolvedValue({ reference: 'DA-001' }),
    },
    validationWorkflow: {
      findFirst: jest.fn().mockResolvedValue({ validators: [] }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ role: 'ACHETEUR' }),
    },
  };
}

function makeFileStorageMock() {
  return {
    getBuffer: jest.fn(),
    getById: jest.fn().mockResolvedValue({ originalName: 'dap.pdf' }),
    upload: jest.fn().mockResolvedValue({ id: 55 }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('PdfSigning — module integration', () => {
  let moduleRef: TestingModule;
  let signingService: PdfSigningService;
  let processor: PdfSigningProcessor;
  let prisma: ReturnType<typeof makePrismaMock>;
  let fileStorage: ReturnType<typeof makeFileStorageMock>;
  let validationAction: { validate: jest.Mock };
  let notificationService: { createNotification: jest.Mock };
  let queue: { add: jest.Mock };

  beforeAll(async () => {
    prisma = makePrismaMock();
    fileStorage = makeFileStorageMock();
    validationAction = {
      validate: jest.fn().mockResolvedValue({ wasCompleted: false }),
    };
    notificationService = {
      createNotification: jest.fn().mockResolvedValue({}),
    };
    queue = { add: jest.fn().mockResolvedValue({ id: 'q-job-1' }) };

    moduleRef = await Test.createTestingModule({
      providers: [
        PdfLibService,
        PdfSigningService,
        PdfSigningProcessor,
        { provide: getQueueToken(PDF_SIGNING_QUEUE), useValue: queue },
        { provide: PrismaService, useValue: prisma },
        { provide: FileStorageService, useValue: fileStorage },
        { provide: ValidationActionService, useValue: validationAction },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    signingService = moduleRef.get(PdfSigningService);
    processor = moduleRef.get(PdfSigningProcessor);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  // ── DI wiring ───────────────────────────────────────────────────────────────

  describe('dependency injection', () => {
    it('resolves PdfSigningService', () => {
      expect(signingService).toBeInstanceOf(PdfSigningService);
    });

    it('resolves PdfSigningProcessor', () => {
      expect(processor).toBeInstanceOf(PdfSigningProcessor);
    });

    it('resolves PdfLibService', () => {
      expect(moduleRef.get(PdfLibService)).toBeInstanceOf(PdfLibService);
    });
  });

  // ── PdfSigningService ────────────────────────────────────────────────────────

  describe('PdfSigningService', () => {
    beforeEach(() => jest.clearAllMocks());

    it('enqueue() puts a job on the queue and returns the id', async () => {
      queue.add.mockResolvedValue({ id: 'job-99' });

      const jobId = await signingService.enqueue('att-abc');

      expect(queue.add).toHaveBeenCalledWith(PDF_SIGNING_JOB, {
        attachmentId: 'att-abc',
      });
      expect(jobId).toBe('job-99');
    });

    it('getStatus() returns the attachment signing status', async () => {
      prisma.attachment.findUnique.mockResolvedValue({
        signingStatus: SigningStatus.PENDING,
        jobId: 'job-99',
      });

      const status = await signingService.getStatus('att-abc');

      expect(status.signingStatus).toBe(SigningStatus.PENDING);
      expect(status.jobId).toBe('job-99');
    });

    it('getStatus() throws NotFoundException for unknown attachment', async () => {
      prisma.attachment.findUnique.mockResolvedValue(null);

      await expect(signingService.getStatus('att-missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── Full signing flow ────────────────────────────────────────────────────────

  describe('PdfSigningProcessor — full flow with real PdfLibService', () => {
    let pdfBuffer: Buffer;

    beforeAll(async () => {
      pdfBuffer = await buildPdfBuffer();
    });

    beforeEach(() => {
      jest.clearAllMocks();

      const attachment = {
        id: 'att-flow',
        purchaseId: 'purch-flow',
        fileId: 10,
        originalFileId: 5,
        signedById: 1,
        specimenId: 3,
        pageNumber: 1,
        positionX: 0.1,
        positionY: 0.1,
        signatureWidth: 0.2,
        specimen: {
          fileId: 20,
          file: { mimeType: 'image/png' },
        },
      };

      prisma.attachment.update.mockResolvedValue({});
      prisma.attachment.findUnique.mockResolvedValue(attachment);
      prisma.purchase.findUnique.mockResolvedValue({ reference: 'DA-001' });
      prisma.validationWorkflow.findFirst.mockResolvedValue({ validators: [] });
      prisma.user.findUnique.mockResolvedValue({ role: 'ACHETEUR' });

      fileStorage.getBuffer
        .mockResolvedValueOnce(pdfBuffer) // PDF
        .mockResolvedValueOnce(MINIMAL_PNG); // signature image
      fileStorage.getById.mockResolvedValue({ originalName: 'dap.pdf' });
      fileStorage.upload.mockResolvedValue({ id: 77 });

      validationAction.validate.mockResolvedValue({ wasCompleted: false });
      notificationService.createNotification.mockResolvedValue({});
    });

    it('completes without error', async () => {
      const job = {
        name: PDF_SIGNING_JOB,
        data: { attachmentId: 'att-flow' },
        id: 'j-1',
      } as any;
      await expect(processor.process(job)).resolves.not.toThrow();
    });

    it('passes through PROCESSING → DONE status transitions', async () => {
      const job = {
        name: PDF_SIGNING_JOB,
        data: { attachmentId: 'att-flow' },
        id: 'j-1',
      } as any;
      await processor.process(job);

      const updates = prisma.attachment.update.mock.calls.map(
        ([arg]: any[]) => arg.data,
      );
      const statuses = updates.map((d: any) => d.signingStatus).filter(Boolean);

      expect(statuses).toContain(SigningStatus.PROCESSING);
      expect(statuses).toContain(SigningStatus.DONE);
    });

    it('saves the signed file and links it on the attachment', async () => {
      const job = {
        name: PDF_SIGNING_JOB,
        data: { attachmentId: 'att-flow' },
        id: 'j-1',
      } as any;
      await processor.process(job);

      expect(fileStorage.upload).toHaveBeenCalledWith(
        expect.objectContaining({ mimetype: 'application/pdf' }),
        expect.objectContaining({ userId: 1, skipOptimization: true }),
      );

      expect(prisma.attachment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fileId: 77,
            signingStatus: SigningStatus.DONE,
          }),
        }),
      );
    });

    it('triggers workflow validation for the signer', async () => {
      const job = {
        name: PDF_SIGNING_JOB,
        data: { attachmentId: 'att-flow' },
        id: 'j-1',
      } as any;
      await processor.process(job);

      expect(validationAction.validate).toHaveBeenCalledWith(
        expect.objectContaining({ purchaseId: 'purch-flow', userId: 1 }),
      );
    });

    it('marks FAILED and rethrows when PDF embedding fails', async () => {
      // Corrupt PDF to force pdf-lib to throw
      fileStorage.getBuffer
        .mockReset()
        .mockResolvedValueOnce(Buffer.from('not-a-pdf'))
        .mockResolvedValueOnce(MINIMAL_PNG);

      const job = {
        name: PDF_SIGNING_JOB,
        data: { attachmentId: 'att-flow' },
        id: 'j-1',
      } as any;
      await expect(processor.process(job)).rejects.toThrow();

      const failedUpdate = prisma.attachment.update.mock.calls.find(
        ([arg]: any[]) => arg.data?.signingStatus === SigningStatus.FAILED,
      );
      expect(failedUpdate).toBeDefined();
    });
  });
});
