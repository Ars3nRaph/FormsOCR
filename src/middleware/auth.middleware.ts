
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError('No valid authorization token provided', 401);
    }

    const token = authHeader.substring(7);
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      throw new ApiError('Invalid or expired token', 401);
    }

    // Get user profile with subscription info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError('User profile not found', 404);
    }

    // Attach user and profile to request
    req.user = user;
    req.profile = profile;
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError('Authentication failed', 401));
    }
  }
};

// Middleware to check subscription limits
export const subscriptionMiddleware = (requiredTier?: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const profile = req.profile;
    
    if (!profile) {
      return next(new ApiError('User profile required', 401));
    }

    // Check if subscription is active
    if (profile.subscription_status !== 'active' && profile.subscription_tier !== 'free') {
      return next(new ApiError('Active subscription required', 403));
    }

    // Check tier requirement
    if (requiredTier) {
      const tierHierarchy = ['free', 'niv1', 'niv2', 'pro'];
      const userTierIndex = tierHierarchy.indexOf(profile.subscription_tier);
      const requiredTierIndex = tierHierarchy.indexOf(requiredTier);
      
      if (userTierIndex < requiredTierIndex) {
        return next(new ApiError(`${requiredTier} subscription or higher required`, 403));
      }
    }

    next();
  };
};

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      user?: any;
      profile?: any;
    }
  }
}
