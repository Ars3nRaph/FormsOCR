
import { Request, Response, NextFunction } from 'express';
import { ocrService } from '../services/ocr.service';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { validateFile } from '../utils/fileValidation';

export class OCRController {
  async processDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new ApiError('No file uploaded', 400);
      }

      // Validate file
      validateFile(req.file);

      const { 
        rois = [], 
        engine = 'tesseract',
        confidence_threshold = 0.7,
        languages = 'eng+fra'
      } = req.body;

      const parsedRois = typeof rois === 'string' ? JSON.parse(rois) : rois;

      logger.info(`Processing document: ${req.file.filename} with ${parsedRois.length} ROIs`);

      const result = await ocrService.processDocument(req.file.path, {
        rois: parsedRois,
        engine,
        confidenceThreshold: confidence_threshold,
        languages
      });

      res.json({
        success: true,
        data: {
          filename: req.file.filename,
          extractedData: result.extractedData,
          confidenceScores: result.confidenceScores,
          processingTime: result.processingTime,
          engine: result.engine,
          metadata: {
            pageCount: result.pageCount,
            imageSize: result.imageSize,
            language: result.detectedLanguage
          }
        }
      });

    } catch (error) {
      logger.error('OCR processing error:', error);
      next(error);
    }
  }

  async extractRegions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new ApiError('No file uploaded', 400);
      }

      validateFile(req.file);

      const { 
        regions = [],
        engine = 'tesseract',
        page = 1,
        scale = 1.0
      } = req.body;

      const parsedRegions = typeof regions === 'string' ? JSON.parse(regions) : regions;

      const result = await ocrService.extractRegions(req.file.path, {
        regions: parsedRegions,
        engine,
        page,
        scale
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Region extraction error:', error);
      next(error);
    }
  }

  async previewDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new ApiError('No file uploaded', 400);
      }

      validateFile(req.file);

      const { page = 1, width = 800, height = 600 } = req.body;

      const result = await ocrService.previewDocument(req.file.path, {
        page,
        width,
        height
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Preview generation error:', error);
      next(error);
    }
  }

  async getEngines(req: Request, res: Response): Promise<void> {
    const engines = await ocrService.getAvailableEngines();
    
    res.json({
      success: true,
      data: {
        engines,
        default: 'tesseract'
      }
    });
  }

  async getStatus(req: Request, res: Response): Promise<void> {
    const status = await ocrService.getServiceStatus();
    
    res.json({
      success: true,
      data: status
    });
  }
}

export const ocrController = new OCRController();
