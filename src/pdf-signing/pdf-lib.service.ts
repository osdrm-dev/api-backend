import { Injectable, HttpStatus } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as crypto from 'crypto';
import { AppException, ErrorCode } from 'src/common/errors';

export interface EmbedSignatureOptions {
  pageNumber: number; // 1-based
  positionX: number; // 0–1, percentage from left
  positionY: number; // 0–1, percentage from top
  signatureWidth: number; // 0–1, percentage of page width
}

export interface EmbedSignatureResult {
  signedBuffer: Buffer;
  hashBefore: string;
  hashAfter: string;
}

@Injectable()
export class PdfLibService {
  async embedSignature(
    pdfBuffer: Buffer,
    imageBuffer: Buffer,
    imageMimeType: string,
    options: EmbedSignatureOptions,
  ): Promise<EmbedSignatureResult> {
    const hashBefore = crypto
      .createHash('sha256')
      .update(pdfBuffer)
      .digest('hex');

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const pageIndex = options.pageNumber - 1;

    if (pageIndex < 0 || pageIndex >= pages.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PDF_PAGE_NOT_FOUND,
        `Page ${options.pageNumber} not found (document has ${pages.length} page(s))`,
        { params: { page: options.pageNumber, pages: pages.length } },
      );
    }

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const embeddedImage =
      imageMimeType === 'image/png'
        ? await pdfDoc.embedPng(imageBuffer)
        : await pdfDoc.embedJpg(imageBuffer);

    const sigWidth = options.signatureWidth * pageWidth;
    const dims = embeddedImage.scale(1);
    const sigHeight = (dims.height / dims.width) * sigWidth;

    // pdf-lib origin: bottom-left — convert from top-left percentage
    const x = options.positionX * pageWidth;
    const y = pageHeight - options.positionY * pageHeight - sigHeight;

    page.drawImage(embeddedImage, { x, y, width: sigWidth, height: sigHeight });

    const signedBytes = await pdfDoc.save();
    const signedBuffer = Buffer.from(signedBytes);
    const hashAfter = crypto
      .createHash('sha256')
      .update(signedBuffer)
      .digest('hex');

    return { signedBuffer, hashBefore, hashAfter };
  }
}
