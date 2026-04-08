import { PdfSigningProcessor } from './pdf-signing.processor';
import { PdfLibService } from './pdf-lib.service';
import { SigningStatus } from '@prisma/client';
import { PDF_SIGNING_JOB } from './pdf-signing.service';

const ATTACHMENT_ID = 'att-1';
const PURCHASE_ID = 'purch-1';
const USER_ID = 7;

const baseAttachment = {
  id: ATTACHMENT_ID,
  purchaseId: PURCHASE_ID,
  fileId: 10,
  originalFileId: 5,
  signedById: USER_ID,
  specimenId: 3,
  pageNumber: 1,
  positionX: 0.1,
  positionY: 0.2,
  signatureWidth: 0.2,
  specimen: {
    fileId: 20,
    file: { mimeType: 'image/png' },
  },
};

function makeJob(name: string = PDF_SIGNING_JOB, attachmentId = ATTACHMENT_ID) {
  return { name, data: { attachmentId }, id: 'j-1' } as any;
}

describe('PdfSigningProcessor', () => {
  let processor: PdfSigningProcessor;
  let mockPrisma: any;
  let mockFileStorage: any;
  let mockPdfLib: any;
  let mockValidationAction: any;
  let mockNotification: any;

  beforeEach(() => {
    mockPrisma = {
      attachment: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(baseAttachment),
      },
      purchase: {
        findUnique: jest.fn().mockResolvedValue({ reference: 'DA-2024-001' }),
      },
      validationWorkflow: {
        findFirst: jest.fn().mockResolvedValue({ validators: [] }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: 'ACHETEUR' }),
      },
    };

    mockFileStorage = {
      getBuffer: jest
        .fn()
        .mockResolvedValueOnce(Buffer.from('pdf-content'))
        .mockResolvedValueOnce(Buffer.from('image-content')),
      getById: jest.fn().mockResolvedValue({ originalName: 'dap.pdf' }),
      upload: jest.fn().mockResolvedValue({ id: 99 }),
    };

    mockPdfLib = {
      embedSignature: jest.fn().mockResolvedValue({
        signedBuffer: Buffer.from('signed-pdf'),
        hashBefore: 'hash-before',
        hashAfter: 'hash-after',
      }),
    };

    mockValidationAction = {
      validate: jest.fn().mockResolvedValue({ wasCompleted: false }),
    };

    mockNotification = {
      createNotification: jest.fn().mockResolvedValue({}),
    };

    processor = new PdfSigningProcessor(
      mockPrisma,
      mockFileStorage,
      mockPdfLib as PdfLibService,
      mockValidationAction,
      mockNotification,
    );
  });

  // ─── Job routing ──────────────────────────────────────────────────────────

  it('does nothing for an unknown job name', async () => {
    await processor.process(makeJob('other-job'));
    expect(mockPrisma.attachment.update).not.toHaveBeenCalled();
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  it('sets PROCESSING before loading data', async () => {
    await processor.process(makeJob());

    expect(mockPrisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ATTACHMENT_ID },
        data: { signingStatus: SigningStatus.PROCESSING },
      }),
    );
  });

  it('loads PDF buffer from originalFileId', async () => {
    await processor.process(makeJob());
    expect(mockFileStorage.getBuffer).toHaveBeenCalledWith(
      baseAttachment.originalFileId,
    );
  });

  it('loads image buffer from specimen fileId', async () => {
    await processor.process(makeJob());
    expect(mockFileStorage.getBuffer).toHaveBeenCalledWith(
      baseAttachment.specimen.fileId,
    );
  });

  it('calls embedSignature with attachment position data', async () => {
    await processor.process(makeJob());

    expect(mockPdfLib.embedSignature).toHaveBeenCalledWith(
      Buffer.from('pdf-content'),
      Buffer.from('image-content'),
      'image/png',
      {
        pageNumber: baseAttachment.pageNumber,
        positionX: baseAttachment.positionX,
        positionY: baseAttachment.positionY,
        signatureWidth: baseAttachment.signatureWidth,
      },
    );
  });

  it('uploads signed buffer as PDF with skipOptimization', async () => {
    await processor.process(makeJob());

    expect(mockFileStorage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        mimetype: 'application/pdf',
        size: Buffer.from('signed-pdf').length,
      }),
      expect.objectContaining({
        userId: USER_ID,
        skipOptimization: true,
      }),
    );
  });

  it('updates attachment to DONE with signed file data', async () => {
    await processor.process(makeJob());

    expect(mockPrisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ATTACHMENT_ID },
        data: expect.objectContaining({
          signingStatus: SigningStatus.DONE,
          fileId: 99,
          signedHash: 'hash-after',
          signedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('calls validate with purchase id and signer user id', async () => {
    await processor.process(makeJob());

    expect(mockValidationAction.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseId: PURCHASE_ID,
        userId: USER_ID,
      }),
    );
  });

  // ─── Notification ─────────────────────────────────────────────────────────

  it('creates a notification when a next validator with email exists', async () => {
    mockPrisma.validationWorkflow.findFirst.mockResolvedValue({
      validators: [{ user: { email: 'cfo@example.com' } }],
    });

    await processor.process(makeJob());

    expect(mockNotification.createNotification).toHaveBeenCalledWith(
      expect.any(String),
      ['cfo@example.com'],
      PURCHASE_ID,
      expect.objectContaining({ reference: 'DA-2024-001' }),
      true,
    );
  });

  it('skips notification when no pending validator has a user email', async () => {
    mockPrisma.validationWorkflow.findFirst.mockResolvedValue({
      validators: [{ user: null }],
    });

    await processor.process(makeJob());

    expect(mockNotification.createNotification).not.toHaveBeenCalled();
  });

  it('skips notification when validator list is empty', async () => {
    mockPrisma.validationWorkflow.findFirst.mockResolvedValue({
      validators: [],
    });

    await processor.process(makeJob());

    expect(mockNotification.createNotification).not.toHaveBeenCalled();
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  it('marks attachment FAILED when an error is thrown', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue({
      ...baseAttachment,
      originalFileId: null, // missing required field → triggers error
    });

    const job = makeJob();
    await expect(processor.process(job)).rejects.toThrow();

    expect(mockPrisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ATTACHMENT_ID },
        data: { signingStatus: SigningStatus.FAILED },
      }),
    );
  });

  it('rethrows the original error so BullMQ can retry', async () => {
    mockPdfLib.embedSignature.mockRejectedValue(new Error('pdf-lib crash'));

    await expect(processor.process(makeJob())).rejects.toThrow('pdf-lib crash');
  });

  it('does NOT mark FAILED and does NOT rethrow when only validation fails', async () => {
    mockValidationAction.validate.mockRejectedValue(new Error('workflow gone'));

    // Should resolve — signing succeeded, validation failure is swallowed
    await expect(processor.process(makeJob())).resolves.not.toThrow();

    // attachment was updated to DONE (not FAILED)
    const doneCalls = mockPrisma.attachment.update.mock.calls.filter(
      ([arg]: any[]) => arg.data?.signingStatus === SigningStatus.DONE,
    );
    expect(doneCalls.length).toBe(1);

    const failedCalls = mockPrisma.attachment.update.mock.calls.filter(
      ([arg]: any[]) => arg.data?.signingStatus === SigningStatus.FAILED,
    );
    expect(failedCalls.length).toBe(0);
  });

  it('does NOT rethrow when notification dispatch fails', async () => {
    mockNotification.createNotification.mockRejectedValue(
      new Error('mail server down'),
    );
    mockPrisma.validationWorkflow.findFirst.mockResolvedValue({
      validators: [{ user: { email: 'om@example.com' } }],
    });

    await expect(processor.process(makeJob())).resolves.not.toThrow();
  });

  // ─── Default position values ──────────────────────────────────────────────

  it('falls back to default position values when attachment fields are null', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue({
      ...baseAttachment,
      pageNumber: null,
      positionX: null,
      positionY: null,
      signatureWidth: null,
    });
    // reset getBuffer mocks consumed in earlier calls
    mockFileStorage.getBuffer
      .mockResolvedValueOnce(Buffer.from('pdf'))
      .mockResolvedValueOnce(Buffer.from('img'));

    await processor.process(makeJob());

    expect(mockPdfLib.embedSignature).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.any(Buffer),
      'image/png',
      { pageNumber: 1, positionX: 0, positionY: 0, signatureWidth: 0.2 },
    );
  });
});
