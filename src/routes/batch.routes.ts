
import { Router } from 'express';
import { batchController } from '../controllers/batch.controller';
import { authMiddleware, subscriptionMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rateLimit.middleware';
import { validateBatchJob } from '../middleware/validation.middleware';

const router = Router();

// All batch routes require authentication
router.use(authMiddleware);

// Create new batch job
router.post('/',
  rateLimitMiddleware('batch'),
  subscriptionMiddleware(),
  validateBatchJob,
  batchController.createBatchJob
);

// Get batch job status
router.get('/:batchId/status',
  batchController.getBatchStatus
);

// Get batch job results
router.get('/:batchId/results',
  batchController.getBatchResults
);

// Cancel batch job
router.post('/:batchId/cancel',
  batchController.cancelBatchJob
);

// Get user's batch jobs
router.get('/user/:userId',
  batchController.getUserBatchJobs
);

export default router;
