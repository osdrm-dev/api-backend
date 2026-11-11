import { ErrorCode } from 'src/common/errors';
import { PdfSigningService, PDF_SIGNING_JOB } from './pdf-signing.service';

const SIGN_PARAMS = {
  signedById: 7,
  specimenId: 3,
  pageNumber: 1,
  positionX: 0.1,
  positionY: 0.2,
  signatureWidth: 0.2,
};

describe('PdfSigningService', () => {
  let service: PdfSigningService;
  let mockQueue: { add: jest.Mock };
  let mockPrisma: { attachment: { findUnique: jest.Mock } };

  beforeEach(() => {
    mockQueue = { add: jest.fn() };
    mockPrisma = { attachment: { findUnique: jest.fn() } };
    service = new PdfSigningService(mockQueue as any, mockPrisma as any);
  });

  describe('enqueue', () => {
    it('adds a job with the correct name and payload', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-42' });

      await service.enqueue('att-1', SIGN_PARAMS);

      expect(mockQueue.add).toHaveBeenCalledWith(PDF_SIGNING_JOB, {
        attachmentId: 'att-1',
        ...SIGN_PARAMS,
      });
    });

    it('returns the job id as a string', async () => {
      mockQueue.add.mockResolvedValue({ id: 123 });

      const jobId = await service.enqueue('att-1', SIGN_PARAMS);

      expect(jobId).toBe('123');
      expect(typeof jobId).toBe('string');
    });
  });

  describe('getStatus', () => {
    it('returns signingStatus and jobId for a known attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        signingStatus: 'DONE',
        jobId: 'job-42',
      });

      const result = await service.getStatus('att-1');

      expect(result.signingStatus).toBe('DONE');
      expect(result.jobId).toBe('job-42');
    });

    it('returns null signingStatus for an unsigned attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        signingStatus: null,
        jobId: null,
      });

      const result = await service.getStatus('att-1');

      expect(result.signingStatus).toBeNull();
      expect(result.jobId).toBeNull();
    });

    it('throws NOT_FOUND when attachment does not exist', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('att-unknown')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('queries by the correct attachmentId', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        signingStatus: 'PENDING',
        jobId: null,
      });

      await service.getStatus('att-specific');

      expect(mockPrisma.attachment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'att-specific' } }),
      );
    });
  });
});
