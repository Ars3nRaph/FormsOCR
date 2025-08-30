
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';

// Enhanced validation schemas with detailed error messages
const ocrRequestSchema = Joi.object({
  rois: Joi.alternatives().try(
    Joi.string().messages({
      'string.base': 'ROIs must be a string or array'
    }),
    Joi.array().items(Joi.object({
      id: Joi.string().required().messages({
        'any.required': 'ROI id is required',
        'string.base': 'ROI id must be a string'
      }),
      name: Joi.string().required().min(1).max(100).messages({
        'any.required': 'ROI name is required',
        'string.min': 'ROI name cannot be empty',
        'string.max': 'ROI name cannot exceed 100 characters'
      }),
      type: Joi.string().valid('text', 'number', 'date', 'currency', 'email', 'checkbox').required().messages({
        'any.required': 'ROI type is required',
        'any.only': 'ROI type must be one of: text, number, date, currency, email, checkbox'
      }),
      coordinates: Joi.object({
        x: Joi.number().min(0).max(100).required().messages({
          'number.min': 'X coordinate must be >= 0',
          'number.max': 'X coordinate must be <= 100',
          'any.required': 'X coordinate is required'
        }),
        y: Joi.number().min(0).max(100).required().messages({
          'number.min': 'Y coordinate must be >= 0',
          'number.max': 'Y coordinate must be <= 100',
          'any.required': 'Y coordinate is required'
        }),
        width: Joi.number().min(1).max(100).required().messages({
          'number.min': 'Width must be >= 1',
          'number.max': 'Width must be <= 100',
          'any.required': 'Width is required'
        }),
        height: Joi.number().min(1).max(100).required().messages({
          'number.min': 'Height must be >= 1',
          'number.max': 'Height must be <= 100',
          'any.required': 'Height is required'
        })
      }).required(),
      regex_pattern: Joi.string().optional().allow('').messages({
        'string.base': 'Regex pattern must be a string'
      }),
      confidence_threshold: Joi.number().min(0).max(1).optional().messages({
        'number.min': 'Confidence threshold must be >= 0',
        'number.max': 'Confidence threshold must be <= 1'
      })
    })).messages({
      'array.base': 'ROIs must be an array'
    })
  ).default([]),
  
  engine: Joi.string().valid('tesseract', 'rapidocr').default('tesseract').messages({
    'any.only': 'OCR engine must be either tesseract or rapidocr'
  }),
  
  confidence_threshold: Joi.number().min(0).max(1).default(0.7).messages({
    'number.min': 'Confidence threshold must be >= 0',
    'number.max': 'Confidence threshold must be <= 1'
  }),
  
  languages: Joi.string().default('eng+fra').messages({
    'string.base': 'Languages must be a string'
  }),

  page: Joi.number().min(1).optional().messages({
    'number.min': 'Page number must be >= 1'
  }),

  scale: Joi.number().min(0.1).max(10).default(1.0).messages({
    'number.min': 'Scale must be >= 0.1',
    'number.max': 'Scale must be <= 10'
  })
});

const regionExtractionSchema = Joi.object({
  regions: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.object({
      x: Joi.number().min(0).max(100).required(),
      y: Joi.number().min(0).max(100).required(),
      width: Joi.number().min(1).max(100).required(),
      height: Joi.number().min(1).max(100).required(),
      name: Joi.string().optional().allow('')
    }))
  ).required().messages({
    'any.required': 'Regions are required for extraction'
  }),
  
  engine: Joi.string().valid('tesseract', 'rapidocr').default('tesseract'),
  page: Joi.number().min(1).default(1),
  scale: Joi.number().min(0.1).max(10).default(1.0)
});

const batchJobSchema = Joi.object({
  projectId: Joi.string().required().messages({
    'any.required': 'Project ID is required',
    'string.base': 'Project ID must be a string'
  }),
  
  name: Joi.string().min(1).max(255).required().messages({
    'any.required': 'Batch job name is required',
    'string.min': 'Batch job name cannot be empty',
    'string.max': 'Batch job name cannot exceed 255 characters'
  }),
  
  processingOptions: Joi.object({
    engine: Joi.string().valid('tesseract', 'rapidocr').default('tesseract'),
    outputFormat: Joi.string().valid('csv', 'json', 'xlsx').default('csv'),
    confidenceThreshold: Joi.number().min(0).max(1).default(0.7),
    languages: Joi.string().default('eng+fra'),
    includeConfidence: Joi.boolean().default(true),
    includeCoordinates: Joi.boolean().default(false)
  }).default({})
});

// File upload validation schema
const fileUploadSchema = Joi.object({
  files: Joi.array().items(
    Joi.object({
      fieldname: Joi.string().required(),
      originalname: Joi.string().required(),
      mimetype: Joi.string().valid(
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/tiff',
        'image/tif'
      ).required().messages({
        'any.only': 'File type must be PDF, PNG, JPEG, JPG, TIFF, or TIF'
      }),
      size: Joi.number().max(52428800).required().messages({
        'number.max': 'File size cannot exceed 50MB'
      })
    })
  ).min(1).required().messages({
    'array.min': 'At least one file is required',
    'any.required': 'Files are required'
  })
});

// Validation middleware factory
const createValidationMiddleware = (schema: Joi.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true
    });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Validation failed:', {
        url: req.url,
        method: req.method,
        errors: errorDetails,
        requestData: data
      });

      return next(new ApiError(
        `Validation error: ${error.details[0].message}`,
        400,
        'VALIDATION_ERROR',
        errorDetails
      ));
    }
    
    req[source] = value;
    next();
  };
};

// Export validation middlewares
export const validateOCRRequest = createValidationMiddleware(ocrRequestSchema);
export const validateRegionExtraction = createValidationMiddleware(regionExtractionSchema);
export const validateBatchJob = createValidationMiddleware(batchJobSchema);
export const validateFileUpload = createValidationMiddleware(fileUploadSchema);

// Additional utility validators
export const validateProjectId = createValidationMiddleware(
  Joi.object({
    id: Joi.string().required().messages({
      'any.required': 'Project ID is required'
    })
  }),
  'params'
);

export const validatePagination = createValidationMiddleware(
  Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    sort: Joi.string().valid('created_at', 'updated_at', 'name').default('created_at'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),
  'query'
);

// Health check validation
export const validateHealthCheck = (req: Request, res: Response, next: NextFunction) => {
  // Simple validation for health check endpoint
  if (req.method !== 'GET') {
    return next(new ApiError('Method not allowed for health check', 405));
  }
  next();
};