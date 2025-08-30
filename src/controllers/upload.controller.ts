
import { Request, Response, NextFunction } from 'express';
import { uploadService } from '../services/upload.service';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { validateFile } from '../utils/fileValidation';

export class UploadController {
  async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new ApiError('No file uploaded', 400);
      }

      validateFile(req.file);

      const userId = req.user?.id;
      if (!userId) {
        throw new ApiError('User authentication required', 401);
      }

      const uploadResult = await uploadService.uploadDocument(req.file, userId);

      res.json({
        success: true,
        data: uploadResult
      });

    } catch (error) {
      logger.error('Document upload error:', error);
      next(error);
    }
  }

  async uploadBatchDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        throw new ApiError('No files uploaded', 400);
      }

      const userId = req.user?.id;
      if (!userId) {
        throw new ApiError('User authentication required', 401);
      }

      // Validate all files
      files.forEach(validateFile);

      const uploadResults = await uploadService.uploadBatchDocuments(files, userId);

      res.json({
        success: true,
        data: uploadResults
      });

    } catch (error) {
      logger.error('Batch documents upload error:', error);
      next(error);
    }
  }

  async uploadTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new ApiError('No template file uploaded', 400);
      }

      validateFile(req.file);

      const userId = req.user?.id;
      if (!userId) {
        throw new ApiError('User authentication required', 401);
      }

      const uploadResult = await uploadService.uploadTemplate(req.file, userId);

      res.json({
        success: true,
        data: uploadResult
      });

    } catch (error) {
      logger.error('Template upload error:', error);
      next(error);
    }
  }
}

export const uploadController = new UploadController();
