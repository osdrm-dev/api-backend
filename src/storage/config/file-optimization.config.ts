export const OptimizationConfig = {
  minSizeForOptimization: 100_000,

  optimizationTimeout: 30_000,

  imageSettings: {
    maxWidth: 2048,
    maxHeight: 2048,
    jpeg: {
      quality: 85,
      progressive: true,
      mozjpeg: true,
    },
    png: {
      quality: 85,
      compressionLevel: 9,
      adaptiveFiltering: true,
    },
    webp: {
      quality: 85,
      effort: 6,
    },
  },

  pdfSettings: {
    maxPageWidth: 842,
    maxPageHeight: 1191,
    useObjectStreams: true,
  },

  skipOptimizationFor: ['text/plain', 'text/csv', 'application/json'],

  shouldOptimize(mimeType: string, fileSize: number): boolean {
    if (fileSize < this.minSizeForOptimization) {
      return false;
    }

    if (this.skipOptimizationFor.includes(mimeType)) {
      return false;
    }

    const optimizableTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    return optimizableTypes.includes(mimeType);
  },
};
