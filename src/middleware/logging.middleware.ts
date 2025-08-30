
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Add request ID for tracing
  req.requestId = uuidv4();
  
  const startTime = Date.now();
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString()
  });

  // Override res.json to log responses
  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Outgoing response', {
      requestId: req.requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: JSON.stringify(body).length,
      timestamp: new Date().toISOString()
    });
    
    return originalJson(body);
  };

  // Handle response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', {
        requestId: req.requestId,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }
  });

  next();
};

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}
