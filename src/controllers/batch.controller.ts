
import { Request, Response, NextFunction } from 'express';
import { batchService } from '../services/batch.service';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';

export class BatchController {
  async createBatchJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId, name, processingOptions } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new ApiError('User authentication required', 401);
      }

      const batchJob = await batchService.createBatchJob({
        projectId,
        userId,
        name,
        processingOptions
      });

      res.status(201).json({
        success: true,
        data: batchJob
      });

    } catch (error) {
      logger.error('Batch job creation error:', error);
      next(error);
    }
  }

  async getBatchStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = req.params;
      const userId = req.user?.id;

      const status = await batchService.getBatchStatus(batchId, userId);

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Batch status retrieval error:', error);
      next(error);
    }
  }

  async getBatchResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = req.params;
      const userId = req.user?.id;

      const results = await batchService.getBatchResults(batchId, userId);

      res.json({
        success: true,
        data: results
      });

    } catch (error) {
      logger.error('Batch results retrieval error:', error);
      next(error);
    }
  }

  async cancelBatchJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = req.params;
      const userId = req.user?.id;

      const cancelled = await batchService.cancelBatchJob(batchId, userId);

      res.json({
        success: true,
        data: { cancelled }
      });

    } catch (error) {
      logger.error('Batch job cancellation error:', error);
      next(error);
    }
  }

  async getUserBatchJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const requestUserId = req.user?.id;

      // Users can only access their own batch jobs
      if (userId !== requestUserId) {
        throw new ApiError('Access denied', 403);
      }

      const batchJobs = await batchService.getUserBatchJobs(userId);

      res.json({
        success: true,
        data: batchJobs
      });

    } catch (error) {
      logger.error('User batch jobs retrieval error:', error);
      next(error);
    }
  }
}

export const batchController = new BatchController();
