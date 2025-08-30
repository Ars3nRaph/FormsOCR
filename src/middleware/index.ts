
import { Application } from 'express';
import { authMiddleware } from './auth.middleware';
import { errorMiddleware } from './error.middleware';
import { loggingMiddleware } from './logging.middleware';
import { rateLimitMiddleware } from './rateLimit.middleware';

export const setupMiddleware = async (app: Application): Promise<void> => {
  // Request logging
  app.use(loggingMiddleware);

  // Global rate limiting
  app.use(rateLimitMiddleware('global'));

  // Error handling (must be last)
  app.use(errorMiddleware);
};

export {
  authMiddleware,
  errorMiddleware,
  loggingMiddleware,
  rateLimitMiddleware
};
