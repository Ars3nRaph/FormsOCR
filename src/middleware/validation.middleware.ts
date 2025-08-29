
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiError } from '../utils/errors';

const ocrRequestSchema = Joi.object({
  rois: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.object({
      id: Joi.string().required(),
      name: Joi.string().required(),
      type: Joi.string().valid('text', 'number', 'date', 'currency', 'email').required(),
      coordinates: Joi.object({
        x: Joi.number().min(0).required(),
        y: Joi.number().min(0).required(),
        width: Joi.number().min(1).required(),
        height: Joi.number().min(1).required()
      }).required(),
      regex_pattern: Joi.string().optional(),
      confidence_threshold: Joi.number().min(0).max(1).optional()
    }))
  ).default([]),
  engine: Joi.string().valid('tesseract', 'rapidocr').default('tesseract'),
  confidence_threshold: Joi.number().min(0).max(1).default(0.7),
  languages: Joi.string().default('eng+fra')
});

const regionExtractionSchema = Joi.object({
  regions: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.object({
      x: Joi.number().min(0).required(),
      y: Joi.number().min(0).required(),
      width: Joi.number().min(1).required(),
      height: Joi.number().min(1).required(),
      name: Joi.string().optional()
    }))
  ).required(),
  engine: Joi.string().valid('tesseract', 'rapidocr').default('tesseract'),
  page: Joi.number().min(1).default(1),
  scale: Joi.number().min(0.1).max(10).default(1.0)
});

const batchJobSchema = Joi.object({
  projectId: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(255).required(),
  processingOptions: Joi.object({
    engine: Joi.string().valid('tesseract', 'rapidocr').default('tesseract'),
    outputFormat: Joi.string().valid('csv', 'json').default('csv'),
    confidenceThreshold: Joi.number().min(0).max(1).default(0.7),
    languages: Joi.string().default('eng+fra')
  }).default({})
});

export const validateOCRRequest = (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = ocrRequestSchema.validate(req.body);
  
  if (error) {
    return next(new ApiError(`Validation error: ${error.details[0].message}`, 400));
  }
  
  req.body = value;
  next();
};

export const validateRegionExtraction = (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = regionExtractionSchema.validate(req.body);
  
  if (error) {
    return next(new ApiError(`Validation error: ${error.details[0].message}`, 400));
  }
  
  req.body = value;
  next();
};

export const validateBatchJob = (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = batchJobSchema.validate(req.body);
  
  if (error) {
    return next(new ApiError(`Validation error: ${error.details[0].message}`, 400));
  }
  
  req.body = value;
  next();
};
