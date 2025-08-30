
import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { ApiError } from '../utils/errors';

// Rate limiters for different endpoints
const limiters = {
  global: new RateLimiterMemory({
    points: 100, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 60, // Block for 60 seconds if limit exceeded
  }),
  
  ocr: new RateLimiterMemory({
    points: 10, // OCR requests are more expensive
    duration: 60,
    blockDuration: 120,
  }),
  
  batch: new RateLimiterMemory({
    points: 5, // Batch operations are very expensive
    duration: 300, // Per 5 minutes
    blockDuration: 600, // Block for 10 minutes
  }),
  
  upload: new RateLimiterMemory({
    points: 20, // File uploads
    duration: 60,
    blockDuration: 180,
  }),
  
  preview: new RateLimiterMemory({
    points: 30, // Preview generation
    duration: 60,
    blockDuration: 60,
  })
};

export const rateLimitMiddleware = (limiterType: keyof typeof limiters = 'global') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limiter = limiters[limiterType];
      const key = req.ip || 'anonymous';
      
      await limiter.consume(key);
      next();
    } catch (rejRes: any) {
      const secs = Math.round((rejRes?.msBeforeNext || 1000) / 1000) || 1;
      
      res.set('Retry-After', String(secs));
      
      return next(new ApiError(
        `Rate limit exceeded. Try again in ${secs} seconds.`,
        429
      ));
    }
  };
};