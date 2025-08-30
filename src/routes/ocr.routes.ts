
import { Router } from 'express';
import { ocrController } from '../controllers/ocr.controller';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { validateOCRRequest } from '../middleware/validation.middleware';
import { rateLimitMiddleware } from '../middleware/rateLimit.middleware';

const router = Router();

// Single document OCR processing
router.post('/process',
  rateLimitMiddleware('ocr'),
  uploadMiddleware.single('document'),
  validateOCRRequest,
  ocrController.processDocument
);

// Extract text from specific regions
router.post('/extract-regions',
  rateLimitMiddleware('ocr'),
  uploadMiddleware.single('document'),
  validateOCRRequest,
  ocrController.extractRegions
);

// Get supported OCR engines
router.get('/engines', ocrController.getEngines);

// Get OCR engine status
router.get('/status', ocrController.getStatus);

// Preview document (convert PDF to images)
router.post('/preview',
  rateLimitMiddleware('preview'),
  uploadMiddleware.single('document'),
  ocrController.previewDocument
);

export default router;
