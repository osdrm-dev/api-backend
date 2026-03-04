import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import { OptimizationConfig } from 'src/storage/config/file-optimization.config';

interface OptimizationResult {
  optimizedPath: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  duration: number;
}

@Injectable()
export class FileOptimizationService {
  private readonly logger = new Logger(FileOptimizationService.name);

  async optimizeFile(
    filePath: string,
    mimeType: string,
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    const originalStats = await fs.stat(filePath);
    const originalSize = originalStats.size;

    if (!OptimizationConfig.shouldOptimize(mimeType, originalSize)) {
      this.logger.log(
        `Skipping optimization for ${mimeType} (${originalSize} bytes)`,
      );
      return {
        optimizedPath: filePath,
        originalSize,
        optimizedSize: originalSize,
        compressionRatio: 0,
        duration: 0,
      };
    }

    let optimizedPath: string;
    let optimizedSize: number;

    try {
      const optimizationPromise = this.performOptimization(filePath, mimeType);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Optimization timeout')),
          OptimizationConfig.optimizationTimeout,
        ),
      );

      optimizedPath = await Promise.race([optimizationPromise, timeoutPromise]);

      const optimizedStats = await fs.stat(optimizedPath);
      optimizedSize = optimizedStats.size;

      const compressionRatio =
        ((originalSize - optimizedSize) / originalSize) * 100;

      const duration = Date.now() - startTime;

      this.logger.log(
        `File optimized in ${duration}ms: ${originalSize} -> ${optimizedSize} bytes (${compressionRatio.toFixed(2)}% reduction)`,
      );

      return {
        optimizedPath,
        originalSize,
        optimizedSize,
        compressionRatio,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Error optimizing file (${duration}ms):`, error);
      return {
        optimizedPath: filePath,
        originalSize,
        optimizedSize: originalSize,
        compressionRatio: 0,
        duration,
      };
    }
  }

  private async performOptimization(
    filePath: string,
    mimeType: string,
  ): Promise<string> {
    if (mimeType.startsWith('image/')) {
      return this.optimizeImage(filePath, mimeType);
    } else if (mimeType === 'application/pdf') {
      return this.optimizePDF(filePath);
    }
    return filePath;
  }

  private async optimizeImage(
    filePath: string,
    mimeType: string,
  ): Promise<string> {
    const ext = path.extname(filePath);
    const optimizedPath = filePath.replace(ext, `_optimized${ext}`);

    const image = sharp(filePath);
    const metadata = await image.metadata();

    const { maxWidth, maxHeight } = OptimizationConfig.imageSettings;

    let pipeline = image;

    if (
      (metadata.width && metadata.width > maxWidth) ||
      (metadata.height && metadata.height > maxHeight)
    ) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      await pipeline
        .jpeg(OptimizationConfig.imageSettings.jpeg)
        .toFile(optimizedPath);
    } else if (mimeType === 'image/png') {
      await pipeline
        .png(OptimizationConfig.imageSettings.png)
        .toFile(optimizedPath);
    } else if (mimeType === 'image/webp') {
      await pipeline
        .webp(OptimizationConfig.imageSettings.webp)
        .toFile(optimizedPath);
    } else {
      await pipeline.toFile(optimizedPath);
    }

    const optimizedStats = await fs.stat(optimizedPath);
    const originalStats = await fs.stat(filePath);

    if (optimizedStats.size >= originalStats.size) {
      await fs.unlink(optimizedPath);
      return filePath;
    }

    await fs.unlink(filePath);
    await fs.rename(optimizedPath, filePath);
    return filePath;
  }

  private async optimizePDF(filePath: string): Promise<string> {
    try {
      const pdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const pages = pdfDoc.getPages();
      const { maxPageWidth, maxPageHeight } = OptimizationConfig.pdfSettings;

      for (const page of pages) {
        const { width, height } = page.getSize();

        if (width > maxPageWidth || height > maxPageHeight) {
          const scale = Math.min(maxPageWidth / width, maxPageHeight / height);
          page.scale(scale, scale);
        }
      }

      const optimizedPdfBytes = await pdfDoc.save({
        useObjectStreams: OptimizationConfig.pdfSettings.useObjectStreams,
        addDefaultPage: false,
      });

      const optimizedPath = filePath.replace('.pdf', '_optimized.pdf');
      await fs.writeFile(optimizedPath, optimizedPdfBytes);

      const optimizedStats = await fs.stat(optimizedPath);
      const originalStats = await fs.stat(filePath);

      if (optimizedStats.size >= originalStats.size) {
        await fs.unlink(optimizedPath);
        return filePath;
      }

      await fs.unlink(filePath);
      await fs.rename(optimizedPath, filePath);
      return filePath;
    } catch (error) {
      this.logger.error('Error optimizing PDF:', error);
      return filePath;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.logger.log(`File deleted: ${filePath}`);
    } catch (error) {
      this.logger.error(`Error deleting file: ${filePath}`, error);
    }
  }
}
