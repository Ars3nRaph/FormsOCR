
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';

interface ExtendedError extends Error {
  code?: string;
  statusCode?: number;
}

export const errorMiddleware = (
  error: ExtendedError | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error middleware caught:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle known API errors
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
        status: error.statusCode,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: error.message,
        status: 400,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Handle file upload errors
  if (error.name === 'MulterError') {
    let message = 'File upload error';
    let status = 400;

    const code = (error as any).code;
    switch (code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
    }

    return res.status(status).json({
      success: false,
      error: {
        message,
        status,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Handle database errors
  if (error.message.includes('duplicate key value')) {
    return res.status(409).json({
      success: false,
      error: {
        message: 'Resource already exists',
        status: 409,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Handle generic errors
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    error: {
      message: isDevelopment ? error.message : 'Internal server error',
      status: 500,
      timestamp: new Date().toISOString(),
      ...(isDevelopment && { stack: error.stack })
    }
  });
};