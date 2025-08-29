
import { Request, Response } from 'express';
import { ocrService } from '../services/ocr.service';
import { logger } from '../utils/logger';

export class HealthController {
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  }

  async systemStatus(req: Request, res: Response): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
          external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      };

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('System status error:', error);
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: errorMessage
      });
    }
  }

  async ocrStatus(req: Request, res: Response): Promise<void> {
    try {
      const ocrStatus = await ocrService.getServiceStatus();

      res.json({
        success: true,
        data: ocrStatus
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('OCR status error:', error);
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }
}

export const healthController = new HealthController();
