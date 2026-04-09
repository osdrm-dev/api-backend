import * as crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { BadRequestException } from '@nestjs/common';
import { PdfLibService } from './pdf-lib.service';

// Minimal 1×1 transparent PNG (valid for pdf-lib embedPng)
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=',
  'base64',
);

async function buildPdf(pageCount = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([595, 842]);
  return Buffer.from(await doc.save());
}

describe('PdfLibService', () => {
  let service: PdfLibService;
  let onePage: Buffer;

  beforeAll(async () => {
    service = new PdfLibService();
    onePage = await buildPdf(1);
  });

  describe('embedSignature', () => {
    it('returns a non-empty signed buffer', async () => {
      const result = await service.embedSignature(
        onePage,
        MINIMAL_PNG,
        'image/png',
        {
          pageNumber: 1,
          positionX: 0.1,
          positionY: 0.1,
          signatureWidth: 0.2,
        },
      );

      expect(result.signedBuffer).toBeInstanceOf(Buffer);
      expect(result.signedBuffer.length).toBeGreaterThan(0);
    });

    it('hashBefore matches SHA256 of the original input buffer', async () => {
      const expected = crypto
        .createHash('sha256')
        .update(onePage)
        .digest('hex');

      const result = await service.embedSignature(
        onePage,
        MINIMAL_PNG,
        'image/png',
        {
          pageNumber: 1,
          positionX: 0,
          positionY: 0,
          signatureWidth: 0.1,
        },
      );

      expect(result.hashBefore).toBe(expected);
    });

    it('hashAfter differs from hashBefore (content was modified)', async () => {
      const result = await service.embedSignature(
        onePage,
        MINIMAL_PNG,
        'image/png',
        {
          pageNumber: 1,
          positionX: 0.5,
          positionY: 0.5,
          signatureWidth: 0.15,
        },
      );

      expect(result.hashAfter).not.toBe(result.hashBefore);
    });

    it('hashAfter matches SHA256 of the returned signedBuffer', async () => {
      const result = await service.embedSignature(
        onePage,
        MINIMAL_PNG,
        'image/png',
        {
          pageNumber: 1,
          positionX: 0.2,
          positionY: 0.2,
          signatureWidth: 0.1,
        },
      );

      const expected = crypto
        .createHash('sha256')
        .update(result.signedBuffer)
        .digest('hex');

      expect(result.hashAfter).toBe(expected);
    });

    it('signed PDF is a valid PDF (loads without error)', async () => {
      const result = await service.embedSignature(
        onePage,
        MINIMAL_PNG,
        'image/png',
        {
          pageNumber: 1,
          positionX: 0,
          positionY: 0,
          signatureWidth: 0.2,
        },
      );

      // Should not throw
      const reloaded = await PDFDocument.load(result.signedBuffer);
      expect(reloaded.getPageCount()).toBe(1);
    });

    it('works on a multi-page PDF targeting the last page', async () => {
      const threePage = await buildPdf(3);

      const result = await service.embedSignature(
        threePage,
        MINIMAL_PNG,
        'image/png',
        {
          pageNumber: 3,
          positionX: 0.8,
          positionY: 0.8,
          signatureWidth: 0.1,
        },
      );

      const reloaded = await PDFDocument.load(result.signedBuffer);
      expect(reloaded.getPageCount()).toBe(3);
    });

    it('throws BadRequestException for page number exceeding page count', async () => {
      await expect(
        service.embedSignature(onePage, MINIMAL_PNG, 'image/png', {
          pageNumber: 99,
          positionX: 0,
          positionY: 0,
          signatureWidth: 0.1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for page number 0', async () => {
      await expect(
        service.embedSignature(onePage, MINIMAL_PNG, 'image/png', {
          pageNumber: 0,
          positionX: 0,
          positionY: 0,
          signatureWidth: 0.1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('clamps image within page bounds at extreme positions', async () => {
      // positionX/Y at 0.99 should not throw — pdf-lib clips out-of-bounds drawing
      await expect(
        service.embedSignature(onePage, MINIMAL_PNG, 'image/png', {
          pageNumber: 1,
          positionX: 0.99,
          positionY: 0.99,
          signatureWidth: 0.1,
        }),
      ).resolves.toBeDefined();
    });
  });
});
