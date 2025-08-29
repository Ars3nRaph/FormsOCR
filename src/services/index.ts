
import { ocrService } from './ocr.service';
import { batchService } from './batch.service';
import { uploadService } from './upload.service';
import { logger } from '../utils/logger';

export const initializeServices = async (): Promise<void> => {
  try {
    logger.info('Initializing services...');

    // Initialize OCR service (Tesseract workers)
    logger.info('OCR service initialized');

    // Start cleanup job for uploaded files
    setInterval(() => {
      uploadService.cleanupOldFiles().catch(error => {
        logger.error('File cleanup error:', error);
      });
    }, 60 * 60 * 1000); // Every hour

    logger.info('All services initialized successfully');

  } catch (error) {
    logger.error('Service initialization failed:', error);
    throw error;
  }
};

export {
  ocrService,
  batchService,
  uploadService
};
