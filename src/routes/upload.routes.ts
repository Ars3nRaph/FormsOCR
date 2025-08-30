
import { Router } from 'express';
import { uploadController } from '../controllers/upload.controller';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rateLimit.middleware';

const router = Router();

// All upload routes require authentication
router.use(authMiddleware);

// Upload single document
router.post('/document',
  rateLimitMiddleware('upload'),
  uploadMiddleware.single('document'),
  uploadController.uploadDocument
);

// Upload multiple documents for batch processing
router.post('/batch',
  rateLimitMiddleware('upload'),
  uploadMiddleware.array('documents', 100),
  uploadController.uploadBatchDocuments
);

// Upload template
router.post('/template',
  rateLimitMiddleware('upload'),
  uploadMiddleware.single('template'),
  uploadController.uploadTemplate
);

export default router;
