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
  versions: null,
};

const specimen = { id: 3, fileId: 20, file: { mimeType: 'image/png' } };

const jobData = {
  attachmentId: ATTACHMENT_ID,
  signedById: USER_ID,
  specimenId: 3,
  pageNumber: 1,
  positionX: 0.1,
  positionY: 0.2,
  signatureWidth: 0.2,
};

function makeJob(name: string = PDF_SIGNING_JOB, data: any = jobData) {
  return { name, data, id: 'j-1' } as any;
}

describe('PdfSigningProcessor', () => {
  let processor: PdfSigningProcessor;
  let mockPrisma: any;
  let mockFileStorage: any;
  let mockPdfLib: any;
  let mockValidation: any;
  let mockNotification: any;

  beforeEach(() => {
    mockPrisma = {
      attachment: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(baseAttachment),
      },
      signatureSpecimen: {
        findUnique: jest.fn().mockResolvedValue(specimen),
      },
      purchase: {
        findUnique: jest.fn().mockResolvedValue({ reference: 'DA-2024-001' }),
      },
      validationWorkflow: {
        findFirst: jest.fn().mockResolvedValue({ validators: [] }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Jean Signataire' }),
      },
    };

    mockFileStorage = {
      getBuffer: jest
        .fn()
        .mockResolvedValueOnce(Buffer.from('pdf-content'))
        .mockResolvedValueOnce(Buffer.from('image-content')),
      getById: jest.fn().mockResolvedValue({ originalName: 'dap.pdf' }),
      upload: jest.fn().mockResolvedValue({ id: 99, url: '/files/99' }),
    };

    mockPdfLib = {
      embedSignature: jest.fn().mockResolvedValue({
        signedBuffer: Buffer.from('signed-pdf'),
        hashBefore: 'hash-before',
        hashAfter: 'hash-after',
      }),
    };

    mockValidation = {
      validateDA: jest.fn().mockResolvedValue({}),
    };

    mockNotification = {
      createNotification: jest.fn().mockResolvedValue({}),
    };

    processor = new PdfSigningProcessor(
      mockPrisma,
      mockFileStorage,
      mockPdfLib as PdfLibService,
      mockValidation,
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

    expect(mockPrisma.attachment.update).toHaveBeenNthCalledWith(1, {
      where: { id: ATTACHMENT_ID },
      data: { signingStatus: SigningStatus.PROCESSING },
    });
  });

  it('signs the original file when there is no previous signature', async () => {
    await processor.process(makeJob());
    expect(mockFileStorage.getBuffer).toHaveBeenNthCalledWith(
      1,
      baseAttachment.fileId,
    );
  });

  it('signs the last signed version when previous signatures exist', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue({
      ...baseAttachment,
      versions: { signatures: [{ fileId: 41 }, { fileId: 42 }] },
    });

    await processor.process(makeJob());

    expect(mockFileStorage.getBuffer).toHaveBeenNthCalledWith(1, 42);
  });

  it('loads the specimen from job data and its image buffer', async () => {
    await processor.process(makeJob());

    expect(mockPrisma.signatureSpecimen.findUnique).toHaveBeenCalledWith({
      where: { id: jobData.specimenId },
      include: { file: true },
    });
    expect(mockFileStorage.getBuffer).toHaveBeenNthCalledWith(
      2,
      specimen.fileId,
    );
  });

  it('calls embedSignature with the job position data', async () => {
    await processor.process(makeJob());

    expect(mockPdfLib.embedSignature).toHaveBeenCalledWith(
      Buffer.from('pdf-content'),
      Buffer.from('image-content'),
      'image/png',
      {
        pageNumber: jobData.pageNumber,
        positionX: jobData.positionX,
        positionY: jobData.positionY,
        signatureWidth: jobData.signatureWidth,
      },
    );
  });

  it('uploads signed buffer as PDF with skipOptimization', async () => {
    await processor.process(makeJob());

    expect(mockFileStorage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        mimetype: 'application/pdf',
        originalname: 'signed-dap.pdf',
        size: Buffer.from('signed-pdf').length,
      }),
      { userId: USER_ID, skipOptimization: true },
    );
  });

  it('marks DONE and appends the signature to versions', async () => {
    await processor.process(makeJob());

    expect(mockPrisma.attachment.update).toHaveBeenLastCalledWith({
      where: { id: ATTACHMENT_ID },
      data: {
        signingStatus: SigningStatus.DONE,
        signedHash: 'hash-after',
        signedAt: expect.any(Date),
        versions: {
          signatures: [
            {
              fileId: 99,
              signedBy: 'Jean Signataire',
              specimenId: jobData.specimenId,
              signedAt: expect.any(Date),
              signedHash: 'hash-after',
              fileUrl: '/files/99',
            },
          ],
        },
      },
    });
  });

  it('validates the DA with purchase id and signer user id', async () => {
    await processor.process(makeJob());

    expect(mockValidation.validateDA).toHaveBeenCalledWith(
      PURCHASE_ID,
      USER_ID,
      {},
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
      { reference: 'DA-2024-001', attachmentId: ATTACHMENT_ID },
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
    await processor.process(makeJob());

    expect(mockNotification.createNotification).not.toHaveBeenCalled();
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  it('marks attachment FAILED when the attachment has no file', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue({
      ...baseAttachment,
      fileId: null,
    });

    await expect(processor.process(makeJob())).rejects.toThrow();

    expect(mockPrisma.attachment.update).toHaveBeenLastCalledWith({
      where: { id: ATTACHMENT_ID },
      data: { signingStatus: SigningStatus.FAILED },
    });
  });

  it('marks attachment FAILED when the specimen is missing', async () => {
    mockPrisma.signatureSpecimen.findUnique.mockResolvedValue(null);

    await expect(processor.process(makeJob())).rejects.toThrow(
      'Specimen 3 not found',
    );
    expect(mockPrisma.attachment.update).toHaveBeenLastCalledWith({
      where: { id: ATTACHMENT_ID },
      data: { signingStatus: SigningStatus.FAILED },
    });
  });

  it('rethrows the original error so BullMQ can retry', async () => {
    mockPdfLib.embedSignature.mockRejectedValue(new Error('pdf-lib crash'));

    await expect(processor.process(makeJob())).rejects.toThrow('pdf-lib crash');
  });

  it('does NOT mark FAILED and does NOT rethrow when only validation fails', async () => {
    mockValidation.validateDA.mockRejectedValue(new Error('workflow gone'));

    await expect(processor.process(makeJob())).resolves.toBeUndefined();

    const statuses = mockPrisma.attachment.update.mock.calls.map(
      ([arg]: any[]) => arg.data?.signingStatus,
    );
    expect(statuses).toContain(SigningStatus.DONE);
    expect(statuses).not.toContain(SigningStatus.FAILED);
  });

  it('does NOT rethrow when notification dispatch fails', async () => {
    mockNotification.createNotification.mockRejectedValue(
      new Error('mail server down'),
    );
    mockPrisma.validationWorkflow.findFirst.mockResolvedValue({
      validators: [{ user: { email: 'om@example.com' } }],
    });

    await expect(processor.process(makeJob())).resolves.toBeUndefined();
  });

  // ─── Default position values ──────────────────────────────────────────────

  it('falls back to default position values when job fields are missing', async () => {
    await processor.process(
      makeJob(PDF_SIGNING_JOB, {
        attachmentId: ATTACHMENT_ID,
        signedById: USER_ID,
        specimenId: 3,
      }),
    );

    expect(mockPdfLib.embedSignature).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.any(Buffer),
      'image/png',
      { pageNumber: 1, positionX: 0, positionY: 0, signatureWidth: 0.2 },
    );
  });
});
