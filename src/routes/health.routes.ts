
import { Router } from 'express';
import { healthController } from '../controllers/health.controller';

const router = Router();

// Basic health check
router.get('/', healthController.healthCheck);

// Detailed system status
router.get('/status', healthController.systemStatus);

// OCR engines status
router.get('/ocr', healthController.ocrStatus);

export default router;
